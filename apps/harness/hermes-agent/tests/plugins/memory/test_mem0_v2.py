"""Tests for Mem0 API v2 compatibility — filters param and dict response unwrapping.

Salvaged from PRs #5301 (qaqcvc) and #5117 (vvvanguards).
"""

import json
import os
import stat

import pytest

from plugins.memory.mem0 import Mem0MemoryProvider


class FakeClientV2:
    """Fake Mem0 client that returns v2-style dict responses and captures call kwargs."""

    def __init__(self, search_results=None, all_results=None):
        self._search_results = search_results or {"results": []}
        self._all_results = all_results or {"results": []}
        self.captured_search = {}
        self.captured_get_all = {}
        self.captured_add = []

    def search(self, **kwargs):
        self.captured_search = kwargs
        return self._search_results

    def get_all(self, **kwargs):
        self.captured_get_all = kwargs
        return self._all_results

    def add(self, messages, **kwargs):
        self.captured_add.append({"messages": messages, **kwargs})


# ---------------------------------------------------------------------------
# Filter migration: bare user_id= -> filters={}
# ---------------------------------------------------------------------------


class TestMem0FiltersV2:
    """All API calls must use filters={} instead of bare user_id= kwargs."""

    def _make_provider(self, monkeypatch, client):
        provider = Mem0MemoryProvider()
        provider.initialize("test-session")
        provider._user_id = "u123"
        provider._agent_id = "hermes"
        monkeypatch.setattr(provider, "_get_client", lambda: client)
        return provider

    def test_search_uses_filters(self, monkeypatch):
        client = FakeClientV2()
        provider = self._make_provider(monkeypatch, client)

        provider.handle_tool_call("mem0_search", {"query": "hello", "top_k": 3, "rerank": False})

        assert client.captured_search["query"] == "hello"
        assert client.captured_search["top_k"] == 3
        assert client.captured_search["rerank"] is False
        assert client.captured_search["filters"] == {"user_id": "u123"}
        # Must NOT have bare user_id kwarg
        assert "user_id" not in {k for k in client.captured_search if k != "filters"}

    def test_profile_uses_filters(self, monkeypatch):
        client = FakeClientV2()
        provider = self._make_provider(monkeypatch, client)

        provider.handle_tool_call("mem0_profile", {})

        assert client.captured_get_all["filters"] == {"user_id": "u123"}
        assert "user_id" not in {k for k in client.captured_get_all if k != "filters"}

    def test_prefetch_uses_filters(self, monkeypatch):
        client = FakeClientV2()
        provider = self._make_provider(monkeypatch, client)

        provider.queue_prefetch("hello")
        provider._prefetch_thread.join(timeout=2)

        assert client.captured_search["query"] == "hello"
        assert client.captured_search["filters"] == {"user_id": "u123"}
        assert "user_id" not in {k for k in client.captured_search if k != "filters"}

    def test_sync_turn_uses_write_filters(self, monkeypatch):
        client = FakeClientV2()
        provider = self._make_provider(monkeypatch, client)

        provider.sync_turn("user said this", "assistant replied", session_id="s1")
        provider._sync_thread.join(timeout=2)

        assert len(client.captured_add) == 1
        call = client.captured_add[0]
        assert call["user_id"] == "u123"
        assert call["agent_id"] == "hermes"

    def test_conclude_uses_write_filters(self, monkeypatch):
        client = FakeClientV2()
        provider = self._make_provider(monkeypatch, client)

        provider.handle_tool_call("mem0_conclude", {"conclusion": "user likes dark mode"})

        assert len(client.captured_add) == 1
        call = client.captured_add[0]
        assert call["user_id"] == "u123"
        assert call["agent_id"] == "hermes"
        assert call["infer"] is False

    def test_read_filters_no_agent_id(self):
        """Read filters should use user_id only — cross-session recall across agents."""
        provider = Mem0MemoryProvider()
        provider._user_id = "u123"
        provider._agent_id = "hermes"
        assert provider._read_filters() == {"user_id": "u123"}

    def test_write_filters_include_agent_id(self):
        """Write filters should include agent_id for attribution."""
        provider = Mem0MemoryProvider()
        provider._user_id = "u123"
        provider._agent_id = "hermes"
        assert provider._write_filters() == {"user_id": "u123", "agent_id": "hermes"}


# ---------------------------------------------------------------------------
# Dict response unwrapping (API v2 wraps in {"results": [...]})
# ---------------------------------------------------------------------------


class TestMem0ResponseUnwrapping:
    """API v2 returns {"results": [...]} dicts; we must extract the list."""

    def _make_provider(self, monkeypatch, client):
        provider = Mem0MemoryProvider()
        provider.initialize("test-session")
        monkeypatch.setattr(provider, "_get_client", lambda: client)
        return provider

    def test_profile_dict_response(self, monkeypatch):
        client = FakeClientV2(all_results={"results": [{"memory": "alpha"}, {"memory": "beta"}]})
        provider = self._make_provider(monkeypatch, client)

        result = json.loads(provider.handle_tool_call("mem0_profile", {}))

        assert result["count"] == 2
        assert "alpha" in result["result"]
        assert "beta" in result["result"]

    def test_profile_list_response_backward_compat(self, monkeypatch):
        """Old API returned bare lists — still works."""
        client = FakeClientV2(all_results=[{"memory": "gamma"}])
        provider = self._make_provider(monkeypatch, client)

        result = json.loads(provider.handle_tool_call("mem0_profile", {}))
        assert result["count"] == 1
        assert "gamma" in result["result"]

    def test_search_dict_response(self, monkeypatch):
        client = FakeClientV2(search_results={
            "results": [{"memory": "foo", "score": 0.9}, {"memory": "bar", "score": 0.7}]
        })
        provider = self._make_provider(monkeypatch, client)

        result = json.loads(provider.handle_tool_call(
            "mem0_search", {"query": "test", "top_k": 5}
        ))

        assert result["count"] == 2
        assert result["results"][0]["memory"] == "foo"

    def test_search_list_response_backward_compat(self, monkeypatch):
        """Old API returned bare lists — still works."""
        client = FakeClientV2(search_results=[{"memory": "baz", "score": 0.8}])
        provider = self._make_provider(monkeypatch, client)

        result = json.loads(provider.handle_tool_call(
            "mem0_search", {"query": "test"}
        ))
        assert result["count"] == 1

    def test_unwrap_results_edge_cases(self):
        """_unwrap_results handles all shapes gracefully."""
        assert Mem0MemoryProvider._unwrap_results({"results": [1, 2]}) == [1, 2]
        assert Mem0MemoryProvider._unwrap_results([3, 4]) == [3, 4]
        assert Mem0MemoryProvider._unwrap_results({}) == []
        assert Mem0MemoryProvider._unwrap_results(None) == []
        assert Mem0MemoryProvider._unwrap_results("unexpected") == []

    def test_prefetch_dict_response(self, monkeypatch):
        client = FakeClientV2(search_results={
            "results": [{"memory": "user prefers dark mode"}]
        })
        provider = Mem0MemoryProvider()
        provider.initialize("test-session")
        monkeypatch.setattr(provider, "_get_client", lambda: client)

        provider.queue_prefetch("preferences")
        provider._prefetch_thread.join(timeout=2)
        result = provider.prefetch("preferences")

        assert "dark mode" in result


# ---------------------------------------------------------------------------
# Default preservation
# ---------------------------------------------------------------------------


@pytest.mark.skipif(os.name == "nt", reason="POSIX mode bits not enforced on Windows")
def test_save_config_sets_owner_only_permissions(tmp_path):
    """mem0.json must be written with 0o600 so API key is not world-readable."""
    provider = Mem0MemoryProvider()
    provider.save_config({"api_key": "m0-test-key"}, str(tmp_path))
    config_file = tmp_path / "mem0.json"
    assert config_file.exists()
    mode = stat.S_IMODE(config_file.stat().st_mode)
    assert mode == 0o600, f"Expected 0o600 (owner-only), got {oct(mode)}"


class TestMem0Defaults:
    """Ensure we don't break existing users' defaults."""

    def test_default_user_id_hermes_user(self, monkeypatch, tmp_path):
        monkeypatch.setenv("MEM0_API_KEY", "test-key")
        monkeypatch.delenv("MEM0_USER_ID", raising=False)
        monkeypatch.setenv("HERMES_HOME", str(tmp_path))

        provider = Mem0MemoryProvider()
        provider.initialize("test")

        assert provider._user_id == "hermes-user"

    def test_default_agent_id_hermes(self, monkeypatch, tmp_path):
        monkeypatch.setenv("MEM0_API_KEY", "test-key")
        monkeypatch.delenv("MEM0_AGENT_ID", raising=False)
        monkeypatch.setenv("HERMES_HOME", str(tmp_path))

        provider = Mem0MemoryProvider()
        provider.initialize("test")

        assert provider._agent_id == "hermes"

    def test_default_mode_is_platform(self, monkeypatch, tmp_path):
        """R16 eval track: self_hosted is opt-in, platform stays the default."""
        monkeypatch.setenv("MEM0_API_KEY", "test-key")
        monkeypatch.delenv("MEM0_MODE", raising=False)
        monkeypatch.setenv("HERMES_HOME", str(tmp_path))

        provider = Mem0MemoryProvider()
        provider.initialize("test")

        assert provider._mode == "platform"


# ---------------------------------------------------------------------------
# Self-hosted mode (R16 eval track — Mem0 OSS + Postgres/pgvector,
# no replacement of the platform path or the Honcho default).
# ---------------------------------------------------------------------------


class TestMem0SelfHostedMode:
    def test_is_available_requires_pg_dsn(self, monkeypatch, tmp_path):
        monkeypatch.setenv("MEM0_MODE", "self_hosted")
        monkeypatch.delenv("MEM0_PG_DSN", raising=False)
        monkeypatch.setenv("HERMES_HOME", str(tmp_path))

        provider = Mem0MemoryProvider()
        assert provider.is_available() is False

    def test_is_available_true_with_pg_dsn(self, monkeypatch, tmp_path):
        monkeypatch.setenv("MEM0_MODE", "self_hosted")
        monkeypatch.setenv("MEM0_PG_DSN", "postgresql://user:pass@localhost:5432/mem0test")
        monkeypatch.setenv("HERMES_HOME", str(tmp_path))

        provider = Mem0MemoryProvider()
        assert provider.is_available() is True

    def test_is_available_ignores_pg_dsn_in_platform_mode(self, monkeypatch, tmp_path):
        """A stray MEM0_PG_DSN must not make platform mode report available
        without an api_key — the two modes' availability checks stay separate."""
        monkeypatch.delenv("MEM0_MODE", raising=False)
        monkeypatch.delenv("MEM0_API_KEY", raising=False)
        monkeypatch.setenv("MEM0_PG_DSN", "postgresql://user:pass@localhost:5432/mem0test")
        monkeypatch.setenv("HERMES_HOME", str(tmp_path))

        provider = Mem0MemoryProvider()
        assert provider.is_available() is False

    def test_initialize_reads_self_hosted_config(self, monkeypatch, tmp_path):
        monkeypatch.setenv("MEM0_MODE", "self_hosted")
        monkeypatch.setenv("MEM0_PG_DSN", "postgresql://user:pass@localhost:5432/mem0test")
        monkeypatch.setenv("MEM0_PG_COLLECTION", "hermes_memories")
        monkeypatch.setenv("HERMES_HOME", str(tmp_path))

        provider = Mem0MemoryProvider()
        provider.initialize("test-session")

        assert provider._mode == "self_hosted"
        assert provider._pg_dsn == "postgresql://user:pass@localhost:5432/mem0test"
        assert provider._pg_collection == "hermes_memories"

    def test_get_client_builds_pgvector_config(self, monkeypatch, tmp_path):
        """_get_client() must hand mem0's OSS Memory class a pgvector
        vector_store pointed at the configured Postgres DSN — never touches
        a real database, from_config is monkeypatched to capture the call."""
        monkeypatch.setenv("MEM0_MODE", "self_hosted")
        monkeypatch.setenv("MEM0_PG_DSN", "postgresql://user:pass@localhost:5432/mem0test")
        monkeypatch.setenv("MEM0_PG_COLLECTION", "hermes_memories")
        monkeypatch.setenv("HERMES_HOME", str(tmp_path))

        captured = {}

        def fake_from_config(config_dict):
            captured["config"] = config_dict
            return object()

        mem0_module = pytest.importorskip("mem0", reason="mem0ai not installed in this environment")
        monkeypatch.setattr(mem0_module.Memory, "from_config", staticmethod(fake_from_config))

        provider = Mem0MemoryProvider()
        provider.initialize("test-session")
        client = provider._get_client()

        assert client is not None
        vector_store = captured["config"]["vector_store"]
        assert vector_store["provider"] == "pgvector"
        assert vector_store["config"]["connection_string"] == "postgresql://user:pass@localhost:5432/mem0test"
        assert vector_store["config"]["collection_name"] == "hermes_memories"

    def test_get_client_self_hosted_missing_dsn_raises(self, monkeypatch, tmp_path):
        monkeypatch.setenv("MEM0_MODE", "self_hosted")
        monkeypatch.delenv("MEM0_PG_DSN", raising=False)
        monkeypatch.setenv("HERMES_HOME", str(tmp_path))

        provider = Mem0MemoryProvider()
        provider.initialize("test-session")

        with pytest.raises(RuntimeError, match="Postgres connection string"):
            provider._get_client()

    def test_platform_mode_still_uses_memory_client(self, monkeypatch, tmp_path):
        """Regression guard: self_hosted mode must not change the platform
        code path — same class, same call shape as before this feature."""
        monkeypatch.delenv("MEM0_MODE", raising=False)
        monkeypatch.setenv("MEM0_API_KEY", "test-key")
        monkeypatch.setenv("HERMES_HOME", str(tmp_path))

        mem0_module = pytest.importorskip("mem0", reason="mem0ai not installed in this environment")
        captured = {}

        class FakeMemoryClient:
            def __init__(self, api_key=None):
                captured["api_key"] = api_key

        monkeypatch.setattr(mem0_module, "MemoryClient", FakeMemoryClient)

        provider = Mem0MemoryProvider()
        provider.initialize("test-session")
        client = provider._get_client()

        assert isinstance(client, FakeMemoryClient)
        assert captured["api_key"] == "test-key"

    def test_search_and_conclude_work_unchanged_in_self_hosted_mode(self, monkeypatch, tmp_path):
        """The OSS Memory client is API-compatible with MemoryClient for the
        calls this provider makes, so handle_tool_call needs zero branching
        on mode — this exercises that end to end against a fake client."""
        monkeypatch.setenv("MEM0_MODE", "self_hosted")
        monkeypatch.setenv("MEM0_PG_DSN", "postgresql://user:pass@localhost:5432/mem0test")
        monkeypatch.setenv("HERMES_HOME", str(tmp_path))

        client = FakeClientV2(search_results={"results": [{"memory": "self-hosted fact", "score": 0.99}]})
        provider = Mem0MemoryProvider()
        provider.initialize("test-session")
        monkeypatch.setattr(provider, "_get_client", lambda: client)

        result = json.loads(provider.handle_tool_call("mem0_search", {"query": "test"}))
        assert result["count"] == 1
        assert result["results"][0]["memory"] == "self-hosted fact"

        provider.handle_tool_call("mem0_conclude", {"conclusion": "runs on self-hosted pgvector"})
        assert len(client.captured_add) == 1
