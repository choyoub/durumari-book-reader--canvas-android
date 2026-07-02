import React from "react";
import { ViewerScreen } from "../screens/ViewerScreen";

type ViewerRestoreLoaderProps = {
  active: boolean;
  onOpenSettings: () => void;
  onReady: () => void;
  onLoadingProgress: (payload: { progress: number; message?: string }) => void;
};

export function ViewerRestoreLoader({
  active,
  onOpenSettings,
  onReady,
  onLoadingProgress,
}: ViewerRestoreLoaderProps) {
  return (
    <ViewerScreen
      onOpenSettings={onOpenSettings}
      onInitialReady={active ? onReady : undefined}
      onInitialLoadingProgress={active ? onLoadingProgress : undefined}
      suppressInitialLoadingOverlay={active}
    />
  );
}
