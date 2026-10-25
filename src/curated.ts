/**
 * Kuratierte „Wissens-Datenbank"-Links — die gewünschte Zusammenstellung großer
 * thematischer Link-Sammlungen, die die eigenen Kategorien ergänzen.
 * In der App unter „Empfehlungen"; mit einem Klick übernehmbar.
 */
export interface CuratedLink {
  title: string;
  url: string;
  category: string;
  description: string;
}

export const CURATED_LINKS: CuratedLink[] = [
  {
    title: 'PromptBase',
    url: 'https://promptbase.com/',
    category: 'Link-Datenbanken',
    description: 'Marktplatz und Sammlung hochwertiger Prompts für KI-Modelle.',
  },
  {
    title: 'FreeStuff.dev',
    url: 'https://freestuff.dev/',
    category: 'Link-Datenbanken',
    description: 'Verzeichnis kostenloser Ressourcen für Entwickler (Tools, Hosting, Credits).',
  },
  {
    title: 'Free for Developers',
    url: 'https://free-for.dev/#/',
    category: 'Link-Datenbanken',
    description: 'Die große Liste von SaaS-/Cloud-Angeboten mit dauerhaft kostenlosem Tier.',
  },
  {
    title: 'Awesome — sindresorhus',
    url: 'https://github.com/sindresorhus/awesome',
    category: 'Link-Datenbanken',
    description: 'Mutter aller Awesome-Listen: kuratierte Themen-Verzeichnisse zu fast allem.',
  },
  {
    title: 'Awesome Selfhosted',
    url: 'https://github.com/awesome-selfhosted/awesome-selfhosted',
    category: 'Link-Datenbanken',
    description: 'Freie Software, die man selbst hosten kann — nach Kategorie durchsuchbar.',
  },
  {
    title: 'Public APIs',
    url: 'https://github.com/public-apis/public-apis',
    category: 'Link-Datenbanken',
    description: 'Umfangreiche Sammlung kostenloser, öffentlicher APIs.',
  },
  {
    title: 'There Is An AI For That',
    url: 'https://theresanaiforthat.com/',
    category: 'KI',
    description: 'Größtes Verzeichnis von KI-Tools nach Aufgabe sortiert.',
  },
  {
    title: 'Futurepedia',
    url: 'https://futurepedia.io/',
    category: 'KI',
    description: 'Kuratorium für KI-Tools und -Webseiten, täglich aktualisiert.',
  },
  {
    title: 'Hugging Face',
    url: 'https://huggingface.co/models',
    category: 'KI-Modelle',
    description: 'Zentrale Modelldatenbank: Open-Weights-Modelle, Datasets, Spaces.',
  },
  {
    title: 'Papers with Code',
    url: 'https://paperswithcode.com/',
    category: 'KI-Modelle',
    description: 'Forschungsarbeiten mit Referenz-Implementierungen und Benchmarks.',
  },
  {
    title: 'Roadmap.sh',
    url: 'https://roadmap.sh/',
    category: 'Entwicklung',
    description: 'Lernpfade und Roadmaps für Entwicklerrollen und -technologien.',
  },
  {
    title: 'System Design Primer',
    url: 'https://github.com/donnemartin/system-design-primer',
    category: 'Entwicklung',
    description: 'Umfassende Sammlung zu System-Design und skalierbarer Architektur.',
  },
];
