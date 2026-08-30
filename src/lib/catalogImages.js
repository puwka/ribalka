/**
 * Resolves catalog image URLs — prefers generated local covers when JPG assets are missing.
 */

import coversManifest from '../data/catalogImageCovers.json';

const coverById = coversManifest.covers || {};

export function getCatalogCoverImages(itemId) {
  const key = String(itemId);
  const list = coverById[key];
  return Array.isArray(list) && list.length ? [...list] : [];
}

/** Prefer generated covers; many legacy /img/bases/*.jpg files are invalid HTML placeholders. */
export function resolveCatalogImages(item) {
  const covers = getCatalogCoverImages(item?.id ?? item?.catalog_legacy_id);
  if (covers.length) return covers;
  return item?.images?.length ? [...item.images] : [];
}

export function withCatalogImages(item) {
  if (!item) return item;
  const images = resolveCatalogImages(item);
  if (!images.length) return item;
  return { ...item, images };
}

export const HERO_IMAGE = '/img/hero/header-img.jpeg';
