import type { AIAdapter } from '../contracts';

export interface MolarChatEmptyStatePrompt {
  label: string;
  /** A lucide-react icon export name (e.g. 'Zap', 'ShieldCheck'). Falls
   *  back to a default icon internally if unrecognized — matches the
   *  pre-extraction DynamicIcon behavior exactly. */
  iconName?: string;
}

export interface MolarChatEmptyState {
  title?: string;
  subtitle?: string;
  /** Clicking a prompt fills the input draft with its label — it does not
   *  auto-send, matching the pre-extraction behavior. */
  prompts?: MolarChatEmptyStatePrompt[];
}

export interface SharedMolarAIProps {
  adapter: AIAdapter;
  disabled?: boolean;
  /** Renders the 🐾 header button when present — omit entirely if the
   *  host has no Virtual Pet concept. The shared UI never imports Virtual
   *  Pet state itself. */
  onPetToggle?: () => void;
  /** Host-supplied, reactively fetched content for the zero-message
   *  welcome state. Omit any field to fall back to the package's own
   *  generic default copy/prompts. */
  emptyState?: MolarChatEmptyState;
}
