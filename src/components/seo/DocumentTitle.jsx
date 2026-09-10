import { useEffect } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { findCatalogById } from '../../lib/catalogSeed';
import { cmsService } from '../../services/cmsService';
import { basesService } from '../../services/basesService';

const ROUTE_META = {
  '/': {
    title: 'Рыбалка в Прикамье — водоёмы, отчёты и карта',
    description: 'Каталог платных и бесплатных водоёмов Пермского края, карта, отчёты рыбаков и лунный календарь.',
  },
  '/paid-waters': {
    title: 'Платные водоёмы Пермского края — Рыбалка в Прикамье',
    description:
      'Каталог платных водоёмов Прикамья: цены, регионы, карта и подробные описания. Рыбалка с оплатой за сутки или вылов.',
  },
  '/free-waters': {
    title: 'Бесплатные водоёмы Пермского края — Рыбалка в Прикамье',
    description:
      'Бесплатные места для рыбалки в Пермском крае: реки, озёра, карта и описания водоёмов без платы.',
  },
  '/map': {
    title: 'Карта водоёмов — Рыбалка в Прикамье',
    description: 'Интерактивная карта платных и бесплатных водоёмов Пермского края.',
  },
  '/tariffs': {
    title: 'Тарифы размещения — Рыбалка в Прикамье',
    description:
      'Тариф Конструктор для платных баз и тариф справочника для магазинов, сервисов, гидов и егерей.',
  },
};

function setMeta(name, content) {
  if (!content) return;
  let el = document.querySelector(`meta[name="${name}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute('name', name);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function setOg(property, content) {
  if (!content) return;
  let el = document.querySelector(`meta[property="${property}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute('property', property);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function setCanonical(href) {
  if (!href) return;
  let el = document.querySelector('link[rel="canonical"]');
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', 'canonical');
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

function waterMetaFromItem(water) {
  if (!water) return null;
  const kind = water.type === 'free' ? 'Бесплатный водоём' : 'Платный водоём';
  const name = water.name || 'Водоём';
  return {
    title: water.seo_title || `${name} — ${kind} | Рыбалка в Прикамье`,
    description:
      water.seo_description || water.short || water.description?.slice(0, 160) || '',
  };
}

function matchMeta(pathname) {
  if (ROUTE_META[pathname]) return ROUTE_META[pathname];
  if (pathname.startsWith('/waters/')) {
    const id = pathname.split('/')[2];
    const water = findCatalogById(id);
    return (
      waterMetaFromItem(water) || {
        title: 'Водоём — Рыбалка в Прикамье',
        description: 'Описание водоёма Пермского края.',
      }
    );
  }
  if (pathname.startsWith('/reports/')) {
    return {
      title: 'Отчёт о рыбалке — Рыбалка в Прикамье',
      description: 'Отчёт рыбака с Прикамья.',
    };
  }
  return {
    title: 'Рыбалка в Прикамье',
    description: 'Рыбалка и отдых в Пермском крае.',
  };
}

export default function DocumentTitle() {
  const { pathname } = useLocation();
  const params = useParams();

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const cmsSeo = await cmsService.getSeoForPath(pathname);
      let fallback = matchMeta(pathname);

      // Актуальное имя базы/водоёма (CMS/API), а не только сид каталога
      if (pathname.startsWith('/waters/')) {
        const id = pathname.split('/')[2] || params.id;
        if (id) {
          try {
            const live = await basesService.getPublic(id);
            const liveMeta = waterMetaFromItem(live);
            if (liveMeta) fallback = liveMeta;
          } catch {
            /* keep seed/fallback */
          }
        }
      }

      if (cancelled) return;

      // Для водоёмов приоритет у актуального названия; SEO-страница из админки
      // не должна оставлять старое имя после переименования базы.
      const isWaterPage = pathname.startsWith('/waters/');
      const useCmsTitle = !isWaterPage && Boolean(cmsSeo?.title?.trim());
      const useCmsDesc = !isWaterPage && Boolean(cmsSeo?.description?.trim());

      const meta = {
        title: useCmsTitle ? cmsSeo.title : fallback.title,
        description: useCmsDesc ? cmsSeo.description : fallback.description,
        keywords: cmsSeo?.keywords || '',
        canonical: cmsSeo?.canonical || '',
        ogTitle: cmsSeo?.ogTitle || (useCmsTitle ? cmsSeo.title : fallback.title),
        ogDescription:
          cmsSeo?.ogDescription || (useCmsDesc ? cmsSeo.description : fallback.description),
        ogImage: cmsSeo?.ogImage || '',
      };

      document.title = meta.title;
      setMeta('description', meta.description);
      if (meta.keywords) setMeta('keywords', meta.keywords);
      setOg('og:title', meta.ogTitle);
      setOg('og:description', meta.ogDescription);
      if (meta.ogImage) setOg('og:image', meta.ogImage);
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      setCanonical(meta.canonical || `${origin}${pathname}`);
    })();

    return () => {
      cancelled = true;
    };
  }, [pathname, params.id]);

  return null;
}
