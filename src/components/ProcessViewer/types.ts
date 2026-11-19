export type HostEventHandler = (eventName: string, widgetId: string, args: unknown[]) => void;

export interface ProcessViewerProps {
  id: string;
  width?: string;
  height?: string;
  events?: string[];
  eventHandler: HostEventHandler;
  draftCount?: number;
  reviewCount?: number;
  creatingPlansCount?: number;
  updatingPlansCount?: number;
  executingPlansCount?: number;
  retryingPlansCount?: number;
  creatingPrCount?: number;
}
