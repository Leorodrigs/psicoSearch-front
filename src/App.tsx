import { useCallback, useEffect, useRef, useState } from "react";
import { ExternalLink, LoaderCircle, MapPin, Phone, Search } from "lucide-react";
import { CategoryDropdown } from "./components/CategoryDropdown";
import type { ApiErrorResponse, PlaceResult, SearchCategory, SearchPage } from "./types";

type SearchStatus = "idle" | "loading" | "success" | "error";

async function readJson<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as T & ApiErrorResponse;
  if (!response.ok) {
    throw new Error(payload.error?.message || "Não foi possível concluir a busca.");
  }
  return payload;
}

function safeWebsite(value: string | null): URL | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

function websiteLabel(url: URL): string {
  return `${url.host}${url.pathname === "/" ? "" : url.pathname}${url.search}`;
}

function phoneHref(value: string): string {
  return `tel:${value.replace(/[^\d+]/g, "")}`;
}

function HeroIllustration() {
  return (
    <svg className="hero-illustration" viewBox="0 0 370 190" aria-hidden="true" fill="none">
      <g stroke="#122b54" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4">
        <path d="M179 155c-25-1-42-4-51-13-5-5-6-13-4-22l-10-12c-3-4-1-8 4-10l5-2c-8-8-12-19-12-31 0-34 25-59 60-59 35 0 61 24 61 57 0 21-9 38-22 49-5 4-7 10-7 18v24" />
        <path d="M153 58c9-13 24-10 30 1 8-11 23-14 33-2 13 17-13 36-33 52-20-16-43-34-30-51Z" />
      </g>
      <g stroke="#5aa9d5" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4">
        <path d="M287 40l8-17m9 32 18-7m-15-9 12-14" />
      </g>
      <g fill="#9bd2e8" opacity=".85">
        <path d="M94 130c-28-10-50-30-59-58 29 8 51 28 59 58Z" />
        <path d="M92 132c-28-3-52 5-72 24 28 6 53-2 72-24Z" />
        <path d="M82 114c-12-25-14-51-4-77 15 24 17 51 4 77Z" />
        <path d="M287 143c22-19 36-43 37-72-24 16-38 40-37 72Z" />
        <path d="M288 145c26-10 52-8 77 6-26 14-52 12-77-6Z" />
        <path d="M298 119c4-27 17-50 39-68-3 28-16 52-39 68Z" />
      </g>
      <g stroke="#79bddb" strokeLinecap="round" strokeWidth="2.5">
        <path d="M89 130 49 82m37 47 5-43m206 57 22-49m-17 46 43-12" />
      </g>
    </svg>
  );
}

export default function App() {
  const [categories, setCategories] = useState<SearchCategory[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [items, setItems] = useState<PlaceResult[]>([]);
  const [searchStatus, setSearchStatus] = useState<SearchStatus>("idle");
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);

  const sentinelRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const activeRunRef = useRef(0);
  const cursorRef = useRef<string | null>(null);
  const hasMoreRef = useRef(false);
  const loadingMoreRef = useRef(false);
  const pagingBlockedRef = useRef(false);
  const userHasScrolledRef = useRef(false);
  const sentinelVisibleRef = useRef(false);
  const requireSentinelExitRef = useRef(false);
  const requestedCursorsRef = useRef(new Set<string>());
  const seenIdsRef = useRef(new Set<string>());
  const loadNextRef = useRef<() => void>(() => undefined);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      setCategoriesLoading(true);
      try {
        const response = await fetch("/api/categories", { signal: controller.signal });
        const payload = await readJson<{ categories: SearchCategory[] }>(response);
        setCategories(payload.categories);
        setCategoriesError(null);
      } catch (error) {
        if (controller.signal.aborted) return;
        setCategoriesError(error instanceof Error ? error.message : "Não foi possível carregar as categorias.");
      } finally {
        if (!controller.signal.aborted) setCategoriesLoading(false);
      }
    })();
    return () => controller.abort();
  }, []);

  const loadNextPage = useCallback(async () => {
    const cursor = cursorRef.current;
    if (
      !cursor ||
      !hasMoreRef.current ||
      loadingMoreRef.current ||
      pagingBlockedRef.current ||
      !userHasScrolledRef.current ||
      requireSentinelExitRef.current ||
      requestedCursorsRef.current.has(cursor)
    ) return;

    const controller = controllerRef.current;
    if (!controller) return;
    const runId = activeRunRef.current;
    requestedCursorsRef.current.add(cursor);
    loadingMoreRef.current = true;
    setIsLoadingMore(true);
    setSearchError(null);

    try {
      const response = await fetch("/api/search/next", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cursor }),
        signal: controller.signal
      });
      const page = await readJson<SearchPage>(response);
      if (runId !== activeRunRef.current) return;

      const newItems = page.items.filter((item) => {
        if (seenIdsRef.current.has(item.id)) return false;
        seenIdsRef.current.add(item.id);
        return true;
      });
      setItems((current) => [...current, ...newItems]);
      cursorRef.current = page.cursor;
      hasMoreRef.current = page.hasMore;
      setHasMore(page.hasMore);
      pagingBlockedRef.current = false;
      requireSentinelExitRef.current = page.hasMore;
    } catch (error) {
      if (controller.signal.aborted || runId !== activeRunRef.current) return;
      pagingBlockedRef.current = true;
      setSearchError(error instanceof Error ? error.message : "Não foi possível carregar mais resultados.");
    } finally {
      if (runId === activeRunRef.current) {
        loadingMoreRef.current = false;
        setIsLoadingMore(false);
      }
    }
  }, []);

  loadNextRef.current = () => { void loadNextPage(); };

  useEffect(() => {
    const onScroll = () => {
      if (window.scrollY > 0) userHasScrolledRef.current = true;
      if (userHasScrolledRef.current && sentinelVisibleRef.current) loadNextRef.current();
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (searchStatus !== "success" || !hasMore || !sentinelRef.current) return;
    const observer = new IntersectionObserver(([entry]) => {
      sentinelVisibleRef.current = entry.isIntersecting;
      if (!entry.isIntersecting) {
        requireSentinelExitRef.current = false;
        return;
      }
      if (userHasScrolledRef.current) loadNextRef.current();
    }, { threshold: 0 });
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, items.length, searchStatus]);

  const toggleCategory = (id: string) => {
    setSelectedIds((current) => current.includes(id)
      ? current.filter((selectedId) => selectedId !== id)
      : [...current, id]);
  };

  const startSearch = async () => {
    if (selectedIds.length === 0 || searchStatus === "loading") return;
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    const runId = ++activeRunRef.current;

    cursorRef.current = null;
    hasMoreRef.current = false;
    loadingMoreRef.current = false;
    pagingBlockedRef.current = false;
    userHasScrolledRef.current = false;
    sentinelVisibleRef.current = false;
    requireSentinelExitRef.current = false;
    requestedCursorsRef.current.clear();
    seenIdsRef.current.clear();
    setItems([]);
    setHasMore(false);
    setIsLoadingMore(false);
    setSearchError(null);
    setSearchStatus("loading");

    try {
      const response = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categories: selectedIds }),
        signal: controller.signal
      });
      const page = await readJson<SearchPage>(response);
      if (runId !== activeRunRef.current) return;

      const uniqueItems = page.items.filter((item) => {
        if (seenIdsRef.current.has(item.id)) return false;
        seenIdsRef.current.add(item.id);
        return true;
      });
      setItems(uniqueItems);
      cursorRef.current = page.cursor;
      hasMoreRef.current = page.hasMore;
      setHasMore(page.hasMore);
      setSearchStatus("success");
    } catch (error) {
      if (controller.signal.aborted || runId !== activeRunRef.current) return;
      setSearchError(error instanceof Error ? error.message : "Não foi possível concluir a busca.");
      setSearchStatus("error");
    }
  };

  const isSearching = searchStatus === "loading";

  return (
    <main className="page-shell">
      <svg className="hero-wave" viewBox="0 0 1440 310" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0 146c132 42 112 116 303 104 164-10 231-82 425-56 176 24 226 93 398 55 151-33 183-113 314-112v173H0Z" fill="#e5f3ff" />
        <path d="M0 166c135 28 161 93 318 79 169-15 245-91 415-65 178 28 232 98 391 64 157-34 209-100 316-107v173H0Z" fill="#f0f7ff" />
      </svg>

      <div className="page-content">
        <header className="page-header">
          <div className="header-copy">
            <h1>Busca de Clínicas e Serviços de Saúde Mental</h1>
            <p>Encontre clínicas e serviços de saúde mental de forma rápida.</p>
          </div>
          <HeroIllustration />
        </header>

        <section className="filter-card" aria-label="Filtros da busca">
          <label className="filter-label" id="categories-label">Categorias</label>
          <div className="filter-controls">
            <CategoryDropdown
              categories={categories}
              selectedIds={selectedIds}
              disabled={categoriesLoading || categories.length === 0}
              onToggle={toggleCategory}
            />
            <button
              type="button"
              className="search-button"
              onClick={() => void startSearch()}
              disabled={selectedIds.length === 0 || isSearching || categoriesLoading}
            >
              {isSearching
                ? <LoaderCircle aria-hidden="true" className="animate-spin" size={30} />
                : <Search aria-hidden="true" size={32} strokeWidth={2.2} />}
              <span>{isSearching ? "Buscando" : "Buscar"}</span>
            </button>
          </div>
          {categoriesError && <p className="inline-error" role="alert">{categoriesError}</p>}
        </section>

        <section className="results-card" aria-labelledby="results-title">
          <h2 id="results-title">Resultados da busca</h2>
          <div className="table-scroll" role="region" aria-label="Resultados da busca" tabIndex={0}>
            <table className="results-table">
              <thead>
                <tr>
                  <th scope="col">Nome</th>
                  <th scope="col">Endereço</th>
                  <th scope="col">Site</th>
                  <th scope="col">Telefone</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const website = safeWebsite(item.website);
                  return (
                    <tr key={item.id}>
                      <td className="place-name">{item.name || "—"}</td>
                      <td>
                        <div className="address-cell">
                          {item.address
                            ? <><MapPin aria-hidden="true" size={21} /><span>{item.address}</span></>
                            : <span className="missing-value">—</span>}
                        </div>
                      </td>
                      <td>
                        {website
                          ? <a className="table-link" href={website.toString()} target="_blank" rel="noopener noreferrer">
                              <ExternalLink aria-hidden="true" size={19} />
                              <span>{websiteLabel(website)}</span>
                            </a>
                          : <span className="missing-value">—</span>}
                      </td>
                      <td>
                        {item.phone
                          ? <a className="phone-link" href={phoneHref(item.phone)}>
                              <Phone aria-hidden="true" size={20} />
                              <span>{item.phone}</span>
                            </a>
                          : <span className="missing-value">—</span>}
                      </td>
                    </tr>
                  );
                })}

                {searchStatus === "loading" && (
                  <tr><td className="table-feedback" colSpan={4}><LoaderCircle className="animate-spin" size={19} /> Buscando estabelecimentos…</td></tr>
                )}
                {searchStatus === "error" && items.length === 0 && (
                  <tr><td className="table-feedback error-feedback" colSpan={4}>{searchError}</td></tr>
                )}
                {searchStatus === "idle" && (
                  <tr><td className="table-feedback" colSpan={4}>Selecione uma ou mais categorias e clique em Buscar.</td></tr>
                )}
                {searchStatus === "success" && items.length === 0 && (
                  <tr><td className="table-feedback" colSpan={4}>Nenhum estabelecimento encontrado para as categorias selecionadas.</td></tr>
                )}
                {isLoadingMore && (
                  <tr><td className="table-feedback" colSpan={4}><LoaderCircle className="animate-spin" size={19} /> Carregando próximos resultados…</td></tr>
                )}
                {searchError && items.length > 0 && (
                  <tr><td className="table-feedback error-feedback" colSpan={4} role="alert">{searchError}</td></tr>
                )}
                {searchStatus === "success" && hasMore && (
                  <tr aria-hidden="true"><td colSpan={4} className="sentinel-cell"><div ref={sentinelRef} className="table-sentinel" /></td></tr>
                )}
              </tbody>
            </table>
          </div>
          <footer className="results-footer">
            <img src="/google-maps-logo.svg" alt="Google Maps" translate="no" className="google-attribution-logo" />
            {searchStatus === "success" && !hasMore && items.length > 0 && (
              <span className="end-note">Não há mais resultados disponíveis.</span>
            )}
          </footer>
        </section>
      </div>
    </main>
  );
}
