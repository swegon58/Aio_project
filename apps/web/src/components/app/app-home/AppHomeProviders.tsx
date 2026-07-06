import type { ReactNode } from "react";
import {
  ChatRuntimeContext,
  WorkspaceContext,
  AccountDataContext,
  type ChatRuntimeContextValue,
  type WorkspaceContextValue,
  type AccountDataContextValue,
} from "@/components/app/app-home/context";

interface AppHomeProvidersProps {
  chatRuntime: ChatRuntimeContextValue;
  workspace: WorkspaceContextValue;
  accountData: AccountDataContextValue;
  children: ReactNode;
}

export function AppHomeProviders({ chatRuntime, workspace, accountData, children }: AppHomeProvidersProps) {
  return (
    <ChatRuntimeContext.Provider value={chatRuntime}>
      <WorkspaceContext.Provider value={workspace}>
        <AccountDataContext.Provider value={accountData}>{children}</AccountDataContext.Provider>
      </WorkspaceContext.Provider>
    </ChatRuntimeContext.Provider>
  );
}
