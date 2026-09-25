import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listingPaymentService } from '../services/listingPaymentService';
import { apiDataEnabled } from '../lib/apiClient';
import {
  DEFAULT_CONSTRUCTOR,
  DEFAULT_SERVICE_TARIFF,
  formatRub,
  normalizeConstructor,
  normalizeServiceTariff,
} from '../lib/directoryPricing';
import './TariffsPage.css';

export default function TariffsPage() {
  const [baseTariff, setBaseTariff] = useState(() => normalizeConstructor(DEFAULT_CONSTRUCTOR));
  const [fishingTariff, setFishingTariff] = useState(() =>
    normalizeConstructor({
      ...DEFAULT_CONSTRUCTOR,
      title: 'Тариф Платная рыбалка',
    })
  );
  const [directoryTariff, setDirectoryTariff] = useState(() =>
    normalizeServiceTariff(DEFAULT_SERVICE_TARIFF)
  );
  const [loading, setLoading] = useState(apiDataEnabled);

  useEffect(() => {
    if (!apiDataEnabled) return;
    let alive = true;
    (async () => {
      try {
        const [ctor, fishing, directory] = await Promise.all([
          listingPaymentService.getPublicListingPrice('paid').catch(() => null),
          listingPaymentService.getPublicListingPrice('paid_fishing').catch(() => null),
          listingPaymentService.getDirectoryPrices().catch(() => null),
        ]);
        if (!alive) return;
        if (ctor) setBaseTariff(normalizeConstructor(ctor));
        if (fishing) setFishingTariff(normalizeConstructor(fishing));
        if (directory?.service || directory?.directory) {
          setDirectoryTariff(
            normalizeServiceTariff(directory.service || directory.directory)
          );
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const ctor = baseTariff;
  const fish = fishingTariff;
  const dir = directoryTariff;

  return (
    <div className="tariffs-page">
      <header className="tariffs-page__hero">
        <div className="tariffs-page__hero-inner">
          <p className="tariffs-page__eyebrow">Размещение на сайте</p>
          <h1>Тарифы</h1>
          <p className="tariffs-page__lead">
            Платные базы, платная рыбалка и справочник — магазины, сервисы, гиды и егеря.
          </p>
        </div>
      </header>

      <div className="tariffs-page__body">
        {loading && <p className="tariffs-page__loading">Загружаем актуальные цены…</p>}

        <section className="tariffs-block" id="bases">
          <div className="tariffs-block__head">
            <h2>Тарифы для платных баз</h2>
            <p>
              Для владельцев рыболовных баз и баз отдыха. Оформление — в кабинете владельца после
              добавления карточки.
            </p>
          </div>

          <article className="tariff-card">
            <div className="tariff-card__top">
              <h3>{ctor.title || 'Конструктор'}</h3>
              <div className="tariff-card__price">
                <strong>{formatRub(ctor.baseAmount)}</strong>
                <span>/ мес</span>
              </div>
            </div>
            <p className="tariff-card__desc">
              Базовый пакет размещения базы на сайте. В тариф входит{' '}
              <strong>{ctor.includedPhotos ?? 1} фото</strong> и{' '}
              <strong>{ctor.includedVideos ?? 1} видео</strong>.
            </p>

            <h4>Дополнительно на выбор</h4>
            <ul className="tariff-card__list">
              <li>
                ТОП на сутки — <strong>{formatRub(ctor.addonTopDaily ?? 300)}</strong>
                <span className="tariff-card__hint">
                  {' '}
                  (в тарифе или докупить отдельно в любой момент, как фото; на главной 4 места)
                </span>
              </li>
              <li>
                Выделение жёлтой рамкой — <strong>+{formatRub(ctor.addonFrame)}/мес</strong>
              </li>
              <li>
                +1 фото — <strong>+{formatRub(ctor.addonPhoto)}</strong> за каждое (можно докупить в
                любой момент)
              </li>
              <li>
                +1 видео — <strong>+{formatRub(ctor.addonVideo)}</strong> за каждое
              </li>
            </ul>

            <h4>Срок оплаты и скидки</h4>
            <ul className="tariff-card__list">
              <li>Минимальный срок — от 3 месяцев</li>
              <li>
                3 месяца — скидка <strong>{ctor.discount3 ?? 10}%</strong>
              </li>
              <li>
                6 месяцев — скидка <strong>{ctor.discount6 ?? 20}%</strong>
              </li>
              <li>
                12 месяцев — скидка <strong>{ctor.discount12 ?? 30}%</strong>
              </li>
            </ul>

            <div className="tariff-card__actions">
              <Link to="/register" className="btn btn--primary">
                Стать владельцем базы
              </Link>
              <Link to="/owner" className="btn btn--ghost">
                Кабинет владельца
              </Link>
            </div>
          </article>
        </section>

        <section className="tariffs-block" id="paid-fishing">
          <div className="tariffs-block__head">
            <h2>Тарифы для платной рыбалки</h2>
            <p>
              Для владельцев водоёмов с платной рыбалкой. Отдельный каталог и отдельный тариф —
              оформление в кабинете владельца.
            </p>
          </div>

          <article className="tariff-card">
            <div className="tariff-card__top">
              <h3>{fish.title || 'Платная рыбалка'}</h3>
              <div className="tariff-card__price">
                <strong>{formatRub(fish.baseAmount)}</strong>
                <span>/ мес</span>
              </div>
            </div>
            <p className="tariff-card__desc">
              Размещение в каталоге «Платная рыбалка». В тариф входит{' '}
              <strong>{fish.includedPhotos ?? 1} фото</strong> и{' '}
              <strong>{fish.includedVideos ?? 1} видео</strong>.
            </p>

            <h4>Дополнительно на выбор</h4>
            <ul className="tariff-card__list">
              <li>
                ТОП на сутки — <strong>{formatRub(fish.addonTopDaily ?? 300)}</strong>
              </li>
              <li>
                Выделение жёлтой рамкой — <strong>+{formatRub(fish.addonFrame)}/мес</strong>
              </li>
              <li>
                +1 фото — <strong>+{formatRub(fish.addonPhoto)}</strong>
              </li>
              <li>
                +1 видео — <strong>+{formatRub(fish.addonVideo)}</strong>
              </li>
            </ul>

            <h4>Срок оплаты и скидки</h4>
            <ul className="tariff-card__list">
              <li>Минимальный срок — от 3 месяцев</li>
              <li>
                3 месяца — скидка <strong>{fish.discount3 ?? 10}%</strong>
              </li>
              <li>
                6 месяцев — скидка <strong>{fish.discount6 ?? 20}%</strong>
              </li>
              <li>
                12 месяцев — скидка <strong>{fish.discount12 ?? 30}%</strong>
              </li>
            </ul>

            <div className="tariff-card__actions">
              <Link to="/paid-fishing" className="btn btn--primary">
                Каталог платной рыбалки
              </Link>
              <Link to="/owner" className="btn btn--ghost">
                Кабинет владельца
              </Link>
            </div>
          </article>
        </section>

        <section className="tariffs-block" id="directory">
          <div className="tariffs-block__head">
            <h2>Тарифы для справочника</h2>
            <p>
              Один тариф для магазинов, сервисов, гидов и егерей. Заявку можно подать на странице
              справочника и оплатить онлайн.
            </p>
          </div>

          <article className="tariff-card tariff-card--alt">
            <div className="tariff-card__top">
              <h3>{dir.title || 'Тариф справочника'}</h3>
              <div className="tariff-card__price">
                <strong>{formatRub(dir.amountPerMonth)}</strong>
                <span>/ мес</span>
              </div>
            </div>
            <p className="tariff-card__desc">Подходит для всех категорий справочника:</p>
            <ul className="tariff-card__list">
              <li>
                <strong>Магазины</strong> — снасти, экипировка, товары для рыбалки
              </li>
              <li>
                <strong>Сервисы</strong> — ремонт, прокат, сопутствующие услуги
              </li>
              <li>
                <strong>Гиды и егеря</strong> — сопровождение, маршруты, инструктаж
              </li>
            </ul>

            <h4>Дополнительно</h4>
            <ul className="tariff-card__list">
              <li>
                ТОП на сутки —{' '}
                <strong>{formatRub(dir.addonTopDaily ?? dir.addonTop ?? 300)}</strong>
                <span className="tariff-card__hint">
                  {' '}
                  (в тарифе или докупить отдельно; 4 места в категории)
                </span>
              </li>
              <li>
                Выделение жёлтой рамкой — <strong>+{formatRub(dir.addonFrame)}/мес</strong>
              </li>
            </ul>

            <h4>Срок оплаты</h4>
            <ul className="tariff-card__list">
              <li>От 3, 6 или 12 месяцев</li>
              {(Number(dir.discount3) || 0) > 0 ||
              (Number(dir.discount6) || 0) > 0 ||
              (Number(dir.discount12) || 0) > 0 ? (
                <>
                  {(Number(dir.discount3) || 0) > 0 ? (
                    <li>
                      3 месяца — скидка <strong>{dir.discount3}%</strong>
                    </li>
                  ) : null}
                  {(Number(dir.discount6) || 0) > 0 ? (
                    <li>
                      6 месяцев — скидка <strong>{dir.discount6}%</strong>
                    </li>
                  ) : null}
                  {(Number(dir.discount12) || 0) > 0 ? (
                    <li>
                      12 месяцев — скидка <strong>{dir.discount12}%</strong>
                    </li>
                  ) : null}
                </>
              ) : (
                <li>Скидки за срок настраиваются в админке</li>
              )}
              <li>После оплаты заявка проходит модерацию и появляется в справочнике</li>
            </ul>

            <div className="tariff-card__actions">
              <Link to="/directory#directory-pricing" className="btn btn--primary">
                Разместить в справочнике
              </Link>
              <Link to="/directory" className="btn btn--ghost">
                Смотреть справочник
              </Link>
            </div>
          </article>
        </section>
      </div>
    </div>
  );
}
