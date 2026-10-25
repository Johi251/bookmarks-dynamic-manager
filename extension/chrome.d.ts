/** Minimale Chrome-/WebExtension-Typen (nur die genutzten APIs) für den Add-on-Build. */

declare namespace chrome {
  namespace runtime {
    function getURL(path: string): string;
    const onInstalled: {
      addListener(cb: () => void): void;
    };
    const onMessage: {
      addListener(
        cb: (msg: { type: string }, sender: unknown, sendResponse: (v: unknown) => void) => boolean | void
      ): void;
    };
    function sendMessage(msg: unknown): Promise<unknown>;
  }
  namespace tabs {
    function query(q: { active?: boolean; currentWindow?: boolean }): Promise<Tab[]>;
    function create(opts: { url: string }): Promise<Tab>;
    interface Tab {
      id?: number;
      url?: string;
      title?: string;
    }
  }
  namespace contextMenus {
    function create(opts: { id?: string; title: string; contexts: string[] }): void;
    function removeAll(cb: () => void): void;
    const onClicked: {
      addListener(cb: (info: { menuItemId: string | number }, tab: Tab | undefined) => void): void;
    };
  }
  namespace action {
    function setBadgeText(opts: { tabId?: number; text: string }): Promise<void>;
  }
  namespace commands {
    const onCommand: {
      addListener(cb: (command: string) => void): void;
    };
  }
  namespace storage {
    const local: {
      get(keys: string | null): Promise<Record<string, unknown>>;
      set(items: Record<string, unknown>): Promise<void>;
      remove(keys: string | string[]): Promise<void>;
    };
    const onChanged: {
      addListener(l: (changes: Record<string, { newValue?: unknown }>, area: string) => void): void;
      removeListener(l: (changes: Record<string, { newValue?: unknown }>, area: string) => void): void;
    };
  }
}
