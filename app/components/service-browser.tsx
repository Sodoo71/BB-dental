"use client";
import { useId, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { money } from "@/lib/domain";
import type { Entity } from "../erp/ui";

const mobileQuery = "(max-width: 600px)";
function subscribeToScreen(onChange: () => void) {
  const query = window.matchMedia(mobileQuery);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}
const isMobile = () => window.matchMedia(mobileQuery).matches;
const serverScreen = () => false;

export default function ServiceBrowser({
  services,
  loading,
  onSelect,
}: {
  services: Entity[];
  loading: boolean;
  onSelect?: (service: Entity) => void;
}) {
  const id = useId();
  const mobile = useSyncExternalStore(
    subscribeToScreen,
    isMobile,
    serverScreen,
  );
  const pageSize = mobile ? 4 : 6;
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [page, setPage] = useState(1);
  const categories = [...new Set(services.map((s) => s.category || "Бусад"))];
  const query = search.trim().toLocaleLowerCase();
  const filtered = services.filter(
    (s) =>
      (!category || (s.category || "Бусад") === category) &&
      (!query ||
        `${s.name} ${s.category || ""} ${s.description || ""}`
          .toLocaleLowerCase()
          .includes(query)),
  );
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const current = Math.min(page, pages);
  const items = filtered.slice((current - 1) * pageSize, current * pageSize);
  const changePage = (next: number) => {
    setPage(next);
    document
      .getElementById(`${id}-results`)
      ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };
  return (
    <div className="service-browser">
      <div className="service-browser-filters">
        <label className="service-browser-search" htmlFor={`${id}-search`}>
          <Search size={18} aria-hidden="true" />
          <input
            id={`${id}-search`}
            type="search"
            aria-label="Үйлчилгээ хайх"
            placeholder="Нэр, түлхүүр үгээр хайх…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </label>
        <div className="service-browser-category">
          <label htmlFor={`${id}-category`}>Ангилал</label>
          <select
            id={`${id}-category`}
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Бүх ангилал</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="service-browser-meta" role="status">
        <span>
          {loading
            ? "Үйлчилгээ ачаалж байна…"
            : `${filtered.length} үйлчилгээ${filtered.length ? ` · ${(current - 1) * pageSize + 1}–${Math.min(current * pageSize, filtered.length)} харуулж байна` : ""}`}
        </span>
        {(search || category) && (
          <button
            type="button"
            onClick={() => {
              setSearch("");
              setCategory("");
              setPage(1);
            }}
          >
            Шүүлт цэвэрлэх
          </button>
        )}
      </div>
      <div
        id={`${id}-results`}
        className="service-browser-results"
        aria-busy={loading}
      >
        {items.map((s) => {
          const content = (
            <>
              <span className="service-browser-content">
                {s.imageUrl && (
                  <Image
                    className="service-browser-thumbnail"
                    src={s.imageUrl}
                    width={52}
                    height={52}
                    unoptimized
                    alt={s.name || "Үйлчилгээ"}
                  />
                )}
                <span className="service-browser-info">
                  <small>{s.category || "Бусад"}</small>
                  <strong>{s.name}</strong>
                  {s.description && (
                    <span className="service-browser-description">
                      {s.description}
                    </span>
                  )}
                  <span className="service-browser-price">
                    {money(s.price || 0)}
                  </span>
                </span>
              </span>
              <ArrowRight size={18} aria-hidden="true" />
            </>
          );
          return onSelect ? (
            <button
              type="button"
              key={s.id}
              className="service-browser-item"
              onClick={() => onSelect(s)}
            >
              {content}
            </button>
          ) : (
            <Link
              key={s.id}
              className="service-browser-item"
              href={`/booking?service=${encodeURIComponent(s.id)}`}
            >
              {content}
            </Link>
          );
        })}
      </div>
      {!loading && !items.length && (
        <div className="service-browser-empty">
          <p>Тохирох үйлчилгээ олдсонгүй.</p>
          <p>Өөр нэрээр хайх эсвэл ангиллаа солино уу.</p>
        </div>
      )}
      {pages > 1 && (
        <nav
          className="service-browser-pagination"
          aria-label="Үйлчилгээний хуудсууд"
        >
          <button
            type="button"
            disabled={current === 1}
            onClick={() => changePage(current - 1)}
          >
            <ChevronLeft size={16} /> Өмнөх
          </button>
          <span aria-live="polite">
            {current} / {pages}
          </span>
          <button
            type="button"
            disabled={current === pages}
            onClick={() => changePage(current + 1)}
          >
            Дараах <ChevronRight size={16} />
          </button>
        </nav>
      )}
    </div>
  );
}
