"use client";
import Link from "next/link";
import { ArrowRight, Stethoscope } from "lucide-react";
import { Feedback, useResource, type Entity } from "../erp/ui";
import ServiceBrowser from "./service-browser";

export default function HomeCatalog() {
  const { data, error, loading, retry } = useResource<{
    services: Entity[];
    doctors: Entity[];
  }>("/api/public/catalog");
  const catalog = data || { services: [], doctors: [] };
  return (
    <>
      <section
        className="public-services"
        id="services"
        aria-labelledby="services-heading"
      >
        <div className="home-service-catalog">
          <div className="home-service-header" id="prices">
            <h2 id="services-heading">Үйлчилгээ</h2>
            <Link href="/booking" className="button">
              Цаг захиалах <ArrowRight size={16} />
            </Link>
          </div>
          {error ? (
            <Feedback retry={retry}>Үйлчилгээг ачаалж чадсангүй.</Feedback>
          ) : (
            <ServiceBrowser services={catalog.services} loading={loading} />
          )}
        </div>
      </section>
      <section className="public-doctors" id="doctors">
        <div className="section-heading">
          <p className="eyebrow">МАНАЙ БАГ</p>
          <h2>Таны төлөө мэргэжлийн эмч нар</h2>
          <p>Эрүүл инээмсэглэлийг хамтдаа бүтээе.</p>
        </div>
        <div className="public-doctor-grid">
          {catalog.doctors.length ? (
            catalog.doctors.map((d) => (
              <article className="public-doctor-card" key={d.id}>
                {d.imageUrl ? (
                  <div
                    className="doctor-photo"
                    style={{
                      backgroundImage: `url("${d.imageUrl.replace(/["\\\n]/g, "")}")`,
                    }}
                    role="img"
                    aria-label={d.name}
                  />
                ) : (
                  <div className="doctor-placeholder">
                    <Stethoscope size={43} />
                  </div>
                )}
                <h3>{d.name}</h3>
                <small>{d.specialty}</small>
                <p>{d.bio}</p>
                <Link
                  className="button button-outline"
                  href={`/booking?doctor=${encodeURIComponent(d.id)}`}
                >
                  Цаг авах <ArrowRight size={16} />
                </Link>
              </article>
            ))
          ) : (
            <p className="public-empty">
              {loading
                ? "Эмчийн мэдээлэл ачаалж байна…"
                : error
                  ? "Эмчийн мэдээлэл ачаалж чадсангүй."
                  : "Эмчийн мэдээлэл удахгүй нэмэгдэнэ."}
            </p>
          )}
        </div>
      </section>
    </>
  );
}
