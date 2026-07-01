-- Consolidates the legacy Hermes-era knowledge/RAG system into the live
-- aio_knowledge_docs/aio_knowledge_chunks system (0015_aio_knowledge.sql).
--
-- hermes_knowledge_files/hermes_knowledge_chunks (0008_knowledge_files.sql)
-- have not fed chat-time retrieval since the aio_knowledge_* tables shipped;
-- the only remaining callers (api/knowledge/route.ts, the AppHome.tsx upload
-- UI, account export/delete) have been removed/repointed at aio_knowledge_*
-- in application code. Both legacy tables are confirmed empty (0 rows) as of
-- 2026-07-01, so no data migration step is needed before the drop.

drop function if exists match_knowledge_chunks(uuid, vector(1536), int);
drop table if exists hermes_knowledge_chunks;
drop table if exists hermes_knowledge_files;
