"use client";

/**
 * Mapa dos leads (Leaflet + tiles do OpenStreetMap).
 *
 * Client Component porque o Leaflet manipula o DOM direto. O import e
 * dinâmico, dentro do efeito, para que nada dele seja avaliado no servidor.
 *
 * Os marcadores são `circleMarker` (SVG puro): não dependem dos arquivos de
 * ícone do Leaflet, que costumam quebrar com bundler, e aceitam a cor do
 * tema. O conteúdo do popup e montado com textContent - nome de empresa vem
 * de fora e nunca e interpolado como HTML.
 */

import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap } from "leaflet";
import { SCORE_LEVEL_LABELS, type LeadMapPoint, type ScoreLevel } from "@/types/lead";
import { formatPhone } from "@/lib/normalize";
import "leaflet/dist/leaflet.css";

/** Cor de cada faixa de score, lida dos tokens do tema. */
function readPalette(): Record<ScoreLevel, string> {
  const styles = getComputedStyle(document.documentElement);
  const token = (name: string, fallback: string) =>
    styles.getPropertyValue(name).trim() || fallback;

  return {
    HIGH: token("--positive", "#15803d"),
    MEDIUM: token("--warning", "#a35b06"),
    LOW: token("--ink-subtle", "#96959d"),
  };
}

function buildPopup(point: LeadMapPoint): HTMLElement {
  const container = document.createElement("div");
  container.className = "flex flex-col gap-0.5";

  const name = document.createElement("a");
  name.href = `/leads/${point.id}`;
  name.textContent = point.name;
  name.className = "text-sm font-medium underline";

  const place = document.createElement("p");
  place.textContent = [point.city, point.state].filter(Boolean).join("/") || "";
  place.className = "text-xs";

  const score = document.createElement("p");
  score.textContent = `Score ${point.score} · ${SCORE_LEVEL_LABELS[point.scoreLevel]}`;
  score.className = "text-xs";

  container.append(name, place, score);

  const phone = formatPhone(point.phone);
  if (phone) {
    const line = document.createElement("p");
    line.textContent = phone;
    line.className = "text-xs";
    container.append(line);
  }
  return container;
}

export function LeadsMap({ points }: { points: readonly LeadMapPoint[] }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function render() {
      const element = containerRef.current;
      if (!element) return;

      try {
        const L = await import("leaflet");
        if (cancelled || mapRef.current) return;

        const map = L.map(element, { scrollWheelZoom: false });
        mapRef.current = map;

        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        }).addTo(map);

        const palette = readPalette();
        const bounds: Array<[number, number]> = [];

        for (const point of points) {
          const coords: [number, number] = [point.latitude, point.longitude];
          bounds.push(coords);

          L.circleMarker(coords, {
            radius: point.scoreLevel === "HIGH" ? 8 : 6,
            color: palette[point.scoreLevel],
            fillColor: palette[point.scoreLevel],
            fillOpacity: 0.65,
            weight: 2,
          })
            .addTo(map)
            .bindPopup(buildPopup(point));
        }

        if (bounds.length > 0) {
          map.fitBounds(bounds, { padding: [32, 32], maxZoom: 15 });
        } else {
          map.setView([-14.24, -51.93], 4); // Brasil inteiro
        }
      } catch {
        if (!cancelled) setFailed(true);
      }
    }

    void render();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [points]);

  if (failed) {
    return (
      <div className="flex h-96 items-center justify-center rounded-lg border border-line bg-surface px-6 text-center text-sm text-ink-muted">
        Não foi possível carregar o mapa. Verifique sua conexão com a internet -
        os tiles vem do OpenStreetMap.
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      role="application"
      aria-label="Mapa dos leads"
      className="h-[28rem] w-full overflow-hidden rounded-lg border border-line bg-surface-muted lg:h-[34rem]"
    />
  );
}
