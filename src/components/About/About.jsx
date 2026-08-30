import './About.css';

export default function About() {
  return (
    <section className="about" id="about">
      <div className="about__container">
        <div className="section-header">
          <div className="section-badge">❤️ Наша история</div>
          <h2 className="section-title">О нас</h2>
          <p className="section-subtitle">
            Познакомьтесь с командой, которая создала этот проект
          </p>
        </div>

        {/* БЛОК С ФОТО И ТЕКСТОМ */}
        <div className="about__intro">
          <div className="about__photo">
            <div className="photo-wrapper">
              <img 
                src="https://images.unsplash.com/photo-1511895426328-dc8714191300?w=800" 
                alt="Семья Михаила и Анастасии" 
              />
              <div className="photo-decoration"></div>
            </div>
            <div className="about__photo-badge">
              <div className="badge-icon">👨‍👩‍👧‍👦</div>
              <div className="badge-text">
                <span className="badge-title">Многодетная семья</span>
                <span className="badge-sub">Михаил и Анастасия</span>
              </div>
            </div>
          </div>

          <div className="about__text">
            <p className="about__greeting">
              Здравствуйте! Меня зовут <strong>Михаил</strong>, а мою супругу — <strong>Анастасия</strong>. 
              Мы — счастливая многодетная семья, и от всего сердца благодарим Вас за посещение нашего сайта!
            </p>
            <p>
              Идея этого проекта давно жила в наших сердцах. Наша миссия — помочь людям быстрее находить 
              красивые места для рыбалки и активного отдыха в Пермском крае. Мы постарались собрать всё 
              самое важное в одном месте: объединили платные базы, коммерческие водоёмы и бесплатные 
              локации в открытом доступе.
            </p>
            <p>
              Все фотографии и видеоматериалы на сайте носят исключительно ознакомительный характер. 
              Мы лично выезжаем на каждое место, делаем фото и видео своими силами, чтобы Вы могли 
              заранее оценить красоту и атмосферу каждого уголка Прикамья.
            </p>
            <p className="about__highlight">
              Очень надеемся, что наш проект придётся Вам по душе и будет оценён по достоинству. 
              Приятного отдыха и удачной рыбалки! 🎣
            </p>
          </div>
        </div>

        {/* БЛОК С НАШИМИ ЦЕННОСТЯМИ */}
        <div className="about__values">
          <h3 className="values-title">Наши ценности</h3>
          <div className="values-grid">
            <div className="value-card">
              <div className="value-icon">🎯</div>
              <h4>Наша миссия</h4>
              <p>
                Помочь каждому человеку найти идеальное место для отдыха и рыбалки 
                в красивейшем Пермском крае.
              </p>
            </div>

            <div className="value-card">
              <div className="value-icon">📸</div>
              <h4>Честный контент</h4>
              <p>
                Все фото и видео мы делаем сами, выезжая на места лично. 
                Никаких стоковых картинок — только реальные места.
              </p>
            </div>

            <div className="value-card">
              <div className="value-icon">🗺️</div>
              <h4>Всё в одном месте</h4>
              <p>
                Платные базы, дикие водоёмы, маршруты, советы — мы собрали 
                всё, что нужно для отличного отдыха.
              </p>
            </div>

            <div className="value-card">
              <div className="value-icon">❤️</div>
              <h4>С любовью к природе</h4>
              <p>
                Мы сами заядлые рыбаки и туристы. Знаем, как важно 
                найти правильное место для душевного отдыха.
              </p>
            </div>
          </div>
        </div>

        {/* БЛОК С ЦИФРАМИ */}
        <div className="about__stats">
          <div className="stat-item">
            <div className="stat-number">50+</div>
            <div className="stat-label">Мест описано</div>
          </div>
          <div className="stat-item">
            <div className="stat-number">100%</div>
            <div className="stat-label">Свои фото и видео</div>
          </div>
          <div className="stat-item">
            <div className="stat-number">24/7</div>
            <div className="stat-label">Обновление контента</div>
          </div>
          <div className="stat-item">
            <div className="stat-number">∞</div>
            <div className="stat-label">Любви к природе</div>
          </div>
        </div>

        {/* ФИНАЛЬНОЕ ОБРАЩЕНИЕ */}
        <div className="about__cta">
          <div className="cta-content">
            <h3>Спасибо, что Вы с нами!</h3>
            <p>
              Мы продолжаем развивать проект и добавлять новые интересные места. 
              Если у Вас есть предложения или Вы хотите поделиться своим опытом — 
              напишите нам, мы всегда рады общению!
            </p>
            <div className="cta-buttons">
              <a href="#contacts" className="cta-btn cta-btn-primary">
                Связаться с нами
              </a>
              <a href="#paid" className="cta-btn cta-btn-secondary">
                Смотреть базы
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}