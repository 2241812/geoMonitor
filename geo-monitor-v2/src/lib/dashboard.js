import { APP } from './app.js';
/**
 * dashboard.js
 * The floating info panel and detail rendering methods.
 */

const BOUNDARY_OVERVIEWS = {
  "CAR": "The Cordillera Administrative Region (CAR) is a landlocked region located in the north-central part of Luzon, Philippines. It encompasses the Cordillera Central mountains and is composed of six provinces—Abra, Apayao, Benguet, Ifugao, Kalinga, and Mountain Province—along with the highly urbanized Baguio City, which serves as the regional center.",
  "Cordillera Administrative Region": "The Cordillera Administrative Region (CAR) is a landlocked region located in the north-central part of Luzon, Philippines. It encompasses the Cordillera Central mountains and is composed of six provinces—Abra, Apayao, Benguet, Ifugao, Kalinga, and Mountain Province—along with the highly urbanized Baguio City, which serves as the regional center.",
  "Abra": "Abra, officially the Province of Abra, is a landlocked province in the Cordillera Administrative Region of the Philippines. Its capital is Bangued, and it is bordered by Ilocos Norte, Ilocos Sur, Apayao, Kalinga, and Mountain Province.",
  "Apayao": "Apayao, officially the Province of Apayao, is a landlocked province in the Cordillera Administrative Region of the Philippines. Its capital is Kabugao, though Luna serves as the main center of government. It is widely known for its pristine rivers, underground caves, and vast, untouched forest covers.",
  "Benguet": "Benguet, officially the Province of Benguet, is a landlocked province at the southern tip of the Cordillera Administrative Region, Philippines. Renowned as the 'Salad Bowl of the Philippines' due to its massive highland vegetable production, its capital is La Trinidad.",
  "Ifugao": "Ifugao, officially the Province of Ifugao, is a landlocked province in the Cordillera Administrative Region, Philippines. Its capital is Lagawe. It is world-famous for the hand-carved Banaue Rice Terraces, a UNESCO World Heritage Site built by the ancestors of its indigenous inhabitants.",
  "Kalinga": "Kalinga, officially the Province of Kalinga, is a landlocked province in the northern section of the Cordillera Administrative Region, Philippines. Its capital is Tabuk. It is characterized by sharp mountain peaks, the mighty Chico River, and a globally celebrated traditional tattooing (Batok) culture.",
  "Mountain Province": "Mountain Province, officially the Mountain Province, is a landlocked province in the central heart of the Cordillera Administrative Region, Philippines. Its capital is Bontoc. It is famous for its rugged mountain terrains, ancient burial traditions, and ecotourism hubs.",
  "Bangued": "Bangued, officially the Municipality of Bangued, is a municipality and capital of the province of Abra, Philippines. According to the 2024 census, it has a population of 48,331 people, making it the most populous municipality in the province.",
  "Aguinaldo": "Aguinaldo, officially the Municipality of Aguinaldo, is a municipality in the province of Ifugao, Philippines. It is primarily an agricultural town known for its mountainous terrain and indigenous Ifugao culture.",
  "Alfonso Lista": "Alfonso Lista, officially the Municipality of Alfonso Lista, is an agricultural municipality in the province of Ifugao. Unlike the rest of Ifugao, it is characterized by rolling plains and serves as a major corn producer in the region.",
  "Asipulo": "Asipulo, officially the Municipality of Asipulo, is a municipality in the province of Ifugao. It is recognized for its pristine natural environments, minor rice terraces, and deep-rooted indigenous traditions.",
  "Atok": "Atok, officially the Municipality of Atok, is a municipality in the province of Benguet. Situated along the Halsema Highway, it is famous for its cold climate, the Northern Blossom Flower Farm, and the breathtaking Mount Timbak.",
  "Baay-Licuan": "Baay-Licuan, officially the Municipality of Baay-Licuan, is a municipality in the province of Abra. Nestled in the Cordillera mountains, it is known for its small-scale mining and rich indigenous Tinggian heritage.",
  "Baguio": "Baguio, officially the City of Baguio, is a highly urbanized city in the Cordillera Administrative Region. Known as the 'Summer Capital of the Philippines,' it is renowned for its cool climate, pine trees, Burnham Park, and vibrant arts scene.",
  "Bakun": "Bakun, officially the Municipality of Bakun, is a mountainous municipality in the province of Benguet. It is a popular destination for hikers seeking to conquer Mount Tenglawan and explore its remote, breathtaking waterfalls.",
  "Balbalan": "Balbalan, officially the Municipality of Balbalan, is a municipality in the province of Kalinga. It is celebrated for its lush, intact forest cover, the subterranean wonders of the Balbalasang-Balbalan National Park, and traditional Kalinga culture.",
  "Banaue": "Banaue, officially the Municipality of Banaue, is a municipality in the province of Ifugao. It is globally famous for the Banaue Rice Terraces, a breathtaking engineering marvel carved into the mountains by indigenous ancestors over 2,000 years ago.",
  "Bangued": "Bangued, officially the Municipality of Bangued, is a municipality and capital of the province of Abra. It serves as the commercial and political hub of the province, overlooked by the scenic Victoria National Park on Casamata Hill.",
  "Barlig": "Barlig, officially the Municipality of Barlig, is a municipality in Mountain Province. It is a tranquil town characterized by its own distinct rice terraces and serves as a major gateway for hikers trekking up Mount Amuyao.",
  "Bauko": "Bauko, officially the Municipality of Bauko, is the most populous municipality in Mountain Province. It is a major agricultural center in the region, known for its vegetable farming and significant cultural heritage sites.",
  "Besao": "Besao, officially the Municipality of Besao, is a municipality in Mountain Province. It is known for its breathtaking stone agricultural terraces, the mysterious Besao stone calendar, and deeply preserved indigenous rituals.",
  "Bokod": "Bokod, officially the Municipality of Bokod, is a municipality in the province of Benguet. It is famously home to the Ambuklao Dam and the scenic Mount Pulag National Park, attracting thousands of hikers annually.",
  "Boliney": "Boliney, officially the Municipality of Boliney, is a remote municipality in the province of Abra. It is known for its rugged mountain terrain, pristine rivers, and the soothing Bani Hot Springs.",
  "Bontoc": "Bontoc, officially the Municipality of Bontoc, is a municipality and capital of Mountain Province. Serving as the province's historical and cultural heart, it is home to the Bontoc Museum and acts as a gateway to the Cordillera highlands.",
  "Bucay": "Bucay, officially the Municipality of Bucay, is a historic municipality in the province of Abra. It briefly served as the first provincial capital of Abra and is known for the ruins of the Casa Real.",
  "Bucloc": "Bucloc, officially the Municipality of Bucloc, is a landlocked municipality in the province of Abra. It is an agricultural and deeply traditional town nestled within the rugged peaks of the Cordillera Central.",
  "Buguias": "Buguias, officially the Municipality of Buguias, is a municipality in the province of Benguet. It is one of the top vegetable-producing towns in the Philippines and is rich in Ibaloi and Kankanaey heritage.",
  "Calanasan": "Calanasan, officially the Municipality of Calanasan, is the largest municipality in the province of Apayao. It is celebrated as a vital sanctuary for the Philippine Eagle and boasts vast, protected virgin forests.",
  "Conner": "Conner, officially the Municipality of Conner, is a municipality in the province of Apayao. It serves as the commercial center of the province, known for its fruit production, specifically rambutan and lanzones.",
  "Daguioman": "Daguioman, officially the Municipality of Daguioman, is a remote municipality in the province of Abra. It is primarily inhabited by the indigenous Tinggian people, deeply connected to its mountainous and heavily forested environment.",
  "Danglas": "Danglas, officially the Municipality of Danglas, is a municipality in the province of Abra. It is a quiet agricultural town largely dependent on rice and corn farming, situated along the provincial border.",
  "Dolores": "Dolores, officially the Municipality of Dolores, is a municipality in the province of Abra. It is known for the peaceful Don Mariano Marcos Bridge and its vibrant local festivals celebrating Tinggian culture.",
  "Flora": "Flora, officially the Municipality of Flora, is an agricultural municipality in the province of Apayao. It is recognized as one of the major rice and corn granaries of the province.",
  "Hingyon": "Hingyon, officially the Municipality of Hingyon, is a municipality in the province of Ifugao. It is a peaceful, culturally rich town offering pristine terraced landscapes away from the heavy tourist crowds of Banaue.",
  "Hungduan": "Hungduan, officially the Municipality of Hungduan, is a municipality in the province of Ifugao. It is renowned for the UNESCO-inscribed Hungduan Rice Terraces and the majestic Mount Napulauan.",
  "Itogon": "Itogon, officially the Municipality of Itogon, is a municipality in the province of Benguet. Historically known as a major gold-mining hub, it is also famous for the Binga Dam, hot springs, and hiking trails like Mount Ugo.",
  "Kabayan": "Kabayan, officially the Municipality of Kabayan, is a municipality in the province of Benguet. It is culturally famous for the centuries-old Ibaloi Fire Mummies hidden in its caves and as a primary jump-off point for Mount Pulag.",
  "Kabugao": "Kabugao, officially the Municipality of Kabugao, is a municipality and capital of the province of Apayao. Despite its capital status, it remains a heavily forested, ecologically rich town along the banks of the Apayao River.",
  "Kapangan": "Kapangan, officially the Municipality of Kapangan, is a municipality in the province of Benguet. It is an emerging eco-tourism destination known for its caves, waterfalls, and the historic Camp Utopia.",
  "Kiangan": "Kiangan, officially the Municipality of Kiangan, is the oldest town in the province of Ifugao. It is deeply historically significant as the site where Japanese General Tomoyuki Yamashita surrendered at the end of World War II.",
  "Kibungan": "Kibungan, officially the Municipality of Kibungan, is a municipality in the province of Benguet. Often referred to as the 'Switzerland of Benguet,' it is characterized by deep ravines, rocky peaks, and cold mountain mists.",
  "La Paz": "La Paz, officially the Municipality of La Paz, is a municipality in the province of Abra. It is a prominent agricultural hub and is well known for its loom-weaving industry and traditional textiles.",
  "La Trinidad": "La Trinidad, officially the Municipality of La Trinidad, is a municipality and capital of the province of Benguet. It is famous for its vast strawberry farms, the colorful Stobosa hillside artwork, and serves as the educational center of the province.",
  "Lacub": "Lacub, officially the Municipality of Lacub, is a municipality in the province of Abra. It is a remote town recognized for its strong indigenous traditions and stunning but rugged mountain environment.",
  "Lagangilang": "Lagangilang, officially the Municipality of Lagangilang, is a municipality in the province of Abra. It is an educational hub in the province, hosting the main campus of the Abra State Institute of Sciences and Technology.",
  "Lagawe": "Lagawe, officially the Municipality of Lagawe, is a municipality and capital of the province of Ifugao. It serves as the commercial and administrative center of the province, featuring scenic valleys and a rich cultural heritage.",
  "Lagayan": "Lagayan, officially the Municipality of Lagayan, is a municipality in the province of Abra. It is known for its tranquil environment, the stunning Lusuac Spring, and its reliance on agriculture and fishing.",
  "Lagiden": "Lagiden, officially the Municipality of Lagiden, is a municipality in the province of Abra. It is a small, quiet town offering scenic views of the Abra River and a strong sense of indigenous community.",
  "Lamut": "Lamut, officially the Municipality of Lamut, is a municipality in the province of Ifugao. It serves as the gateway to the province from Nueva Vizcaya and is home to the Ifugao State University.",
  "Luba": "Luba, officially the Municipality of Luba, is a municipality in the province of Abra. It is characterized by its agricultural plains nestled between mountain ranges and is bisected by the mighty Abra River.",
  "Lubuagan": "Lubuagan, officially the Municipality of Lubuagan, is a historic municipality in the province of Kalinga. It briefly served as the seat of the First Philippine Republic under Emilio Aguinaldo in 1899 and is famous for its traditional backstrap loom weaving.",
  "Luna": "Luna, officially the Municipality of Luna, is a municipality in the province of Apayao. Serving as the de facto center of government and commerce for the province, it is known for its caves and agricultural output.",
  "Malibcong": "Malibcong, officially the Municipality of Malibcong, is a municipality in the province of Abra. Nestled deep in the mountains, it is culturally rich, heavily forested, and inhabited by the indigenous Tinggian communities.",
  "Manabo": "Manabo, officially the Municipality of Manabo, is a municipality in the province of Abra. It is an agricultural town renowned for its extensive rice fields, utilizing traditional irrigation systems fed by the Abra River.",
  "Mankayan": "Mankayan, officially the Municipality of Mankayan, is a municipality in the province of Benguet. It is historically and economically significant for its large-scale copper and gold mining operations.",
  "Mayoyao": "Mayoyao, officially the Municipality of Mayoyao, is a municipality in the province of Ifugao. It is home to the pristine Mayoyao Rice Terraces, a UNESCO World Heritage Site, and boasts deeply preserved traditional Ifugao architecture.",
  "Natonin": "Natonin, officially the Municipality of Natonin, is a municipality in Mountain Province. It is a remote town known for its distinct terraced landscapes and strong preservation of indigenous Balangao culture.",
  "Paracelis": "Paracelis, officially the Municipality of Paracelis, is the easternmost municipality in Mountain Province. Unlike the rugged highlands, it features rolling hills and plains, heavily focused on corn and fruit production.",
  "Pasil": "Pasil, officially the Municipality of Pasil, is a municipality in the province of Kalinga. It is famed for its slow-food heritage, specifically the traditional unoy rice, and its ruggedly beautiful mountain landscapes.",
  "Penarrubia": "Peñarrubia, officially the Municipality of Peñarrubia, is a municipality in the province of Abra. It is highly recognized for its robust indigenous Tinggian culture and traditional festivals.",
  "Pidigan": "Pidigan, officially the Municipality of Pidigan, is a historic municipality in the province of Abra. It is known as the birthplace of Gabriela Silang, a legendary heroine of the Philippine revolution.",
  "Pilar": "Pilar, officially the Municipality of Pilar, is a municipality in the province of Abra. It is largely agricultural and is historically significant for its ancient burial sites and indigenous artifacts.",
  "Pinukpuk": "Pinukpuk, officially the Municipality of Pinukpuk, is a municipality in the province of Kalinga. Acting as a gateway to the province, it is characterized by its vast agricultural lands and the confluence of the Chico and Saltan rivers.",
  "Pudtol": "Pudtol, officially the Municipality of Pudtol, is a municipality in the province of Apayao. It is home to the historic Pudtol Church ruins, one of the oldest Spanish colonial structures in the Cordillera region.",
  "Rizal (Liwan)": "Rizal, officially the Municipality of Rizal, is a municipality in the province of Kalinga. Primarily a lowland agricultural town, it is often referred to as the rice granary of Kalinga.",
  "Rizal": "Rizal, officially the Municipality of Rizal, is a municipality in the province of Kalinga. Primarily a lowland agricultural town, it is often referred to as the rice granary of Kalinga.",
  "Sabangan": "Sabangan, officially the Municipality of Sabangan, is a municipality in Mountain Province. It is known for its picturesque mountains, serene atmosphere, and as the home of the cascading Mount Data.",
  "Sablan": "Sablan, officially the Municipality of Sablan, is a municipality in the province of Benguet. Recognized as the 'Fruit Basket of Benguet,' it produces an abundance of pineapples, bananas, and other tropical fruits.",
  "Sadanga": "Sadanga, officially the Municipality of Sadanga, is a municipality in Mountain Province. It is fiercely protective of its ancient cultural heritage, known for its indigenous socio-political systems and scenic rice terraces.",
  "Sagada": "Sagada, officially the Municipality of Sagada, is a highly popular municipality in Mountain Province. It is world-renowned for its hanging coffins, limestone caves, breathtaking waterfalls, and vibrant backpacker tourism.",
  "Sallapadan": "Sallapadan, officially the Municipality of Sallapadan, is a municipality in the province of Abra. It is a forested, agricultural town that serves as a quiet sanctuary for indigenous Tinggian culture.",
  "San Isidro": "San Isidro, officially the Municipality of San Isidro, is a municipality in the province of Abra. It is a tranquil agricultural town heavily dependent on farming and the natural resources of the region.",
  "San Juan": "San Juan, officially the Municipality of San Juan, is a municipality in the province of Abra. It is known for its beautiful natural landscapes, quiet rural lifestyle, and strong local agricultural traditions.",
  "San Quintin": "San Quintin, officially the Municipality of San Quintin, is a municipality in the province of Abra. As the gateway to Abra from Ilocos Sur, it is famous for the Tangadan Tunnel and a welcoming atmosphere.",
  "Santa Marcela": "Santa Marcela, officially the Municipality of Santa Marcela, is a municipality in the province of Apayao. It is known for the scenic Bacut Lake, a rising eco-tourism destination offering peaceful boating and fishing.",
  "Tabuk": "Tabuk, officially the City of Tabuk, is a component city and capital of the province of Kalinga. It serves as the economic hub of the province and is famous for its vast rice plains and thrilling Chico River white-water rafting.",
  "Tadian": "Tadian, officially the Municipality of Tadian, is a municipality in Mountain Province. It is known for the scenic Mount Clitoris (Mount Mogao) and its rich cultural heritage rooted in the Kankanaey people.",
  "Tanudan": "Tanudan, officially the Municipality of Tanudan, is a municipality in the province of Kalinga. It is a remote, heavily forested town renowned for its pristine natural environment and preserved indigenous traditions.",
  "Tayum": "Tayum, officially the Municipality of Tayum, is a historic municipality in the province of Abra. It is known for its Spanish-era architecture, including the Santa Catalina de Alejandria Parish Church, a national cultural treasure.",
  "Tineg": "Tineg, officially the Municipality of Tineg, is the largest and most remote municipality in the province of Abra. It is celebrated for its breathtaking waterfalls, such as the Kaparkan Falls, and its immense untouched forest reserves.",
  "Tinglayan": "Tinglayan, officially the Municipality of Tinglayan, is a municipality in the province of Kalinga. It is globally famous as the home of Apo Whang-Od, the legendary mambabatok (traditional tattoo artist), drawing tourists from around the world.",
  "Tinoc": "Tinoc, officially the Municipality of Tinoc, is a municipality in the province of Ifugao. Bordering Benguet, it is a high-altitude town known for its vegetable farming, cool climate, and rugged mountain passes.",
  "Tuba": "Tuba, officially the Municipality of Tuba, is a municipality in the province of Benguet. Serving as a major gateway to Baguio City via Marcos Highway and Kennon Road, it is home to the majestic Mount Ulap and a thriving tourism sector.",
  "Tublay": "Tublay, officially the Municipality of Tublay, is a municipality in the province of Benguet. It is known for its natural caves, hot springs, and growing agricultural and eco-tourism industries.",
  "Tubo": "Tubo, officially the Municipality of Tubo, is a municipality in the province of Abra. It is a rugged, mountainous town known for the remote Mount Bangbanglang and its deeply ingrained Tinggian traditions.",
  "Villaviciosa": "Villaviciosa, officially the Municipality of Villaviciosa, is a municipality in the province of Abra. It is a quiet, agricultural town known for the picturesque Kimkimay Lake, a popular local destination.",
  "Baay-Licuan vs Lacub vs Lagangilang": "This area represents an overlapping boundary polygon within the CAD dataset, denoting an administrative boundary overlap between the municipalities of Baay-Licuan, Lacub, and Lagangilang in the province of Abra. Such polygons account for historical data alignment variances or ongoing territorial boundary delineations.",
  "Bauko vs Sabangan vs Sagada": "This area represents an overlapping boundary polygon within the CAD dataset, denoting an administrative boundary overlap between the municipalities of Bauko, Sabangan, and Sagada in Mountain Province. Such polygons account for historical data alignment variances or ongoing territorial boundary delineations.",
  "Aguinaldo vs Natonin vs Paracelis": "This area represents an overlapping boundary polygon within the CAD dataset, denoting an administrative boundary overlap between the municipalities of Aguinaldo, Natonin, and Paracelis in the provinces of Ifugao and Mountain Province. Such polygons account for historical data alignment variances or ongoing territorial boundary delineations.",
  "Bucay vs Lagangilang": "This area represents an overlapping boundary polygon within the CAD dataset, denoting an administrative boundary overlap between the municipalities of Bucay and Lagangilang in the province of Abra. Such polygons account for historical data alignment variances or ongoing territorial boundary delineations.",
  "Manabo vs Sallapadan": "This area represents an overlapping boundary polygon within the CAD dataset, denoting an administrative boundary overlap between the municipalities of Manabo and Sallapadan in the province of Abra. Such polygons account for historical data alignment variances or ongoing territorial boundary delineations.",
  "Malibcong vs Daguioman": "This area represents an overlapping boundary polygon within the CAD dataset, denoting an administrative boundary overlap between the municipalities of Malibcong and Daguioman in the province of Abra. Such polygons account for historical data alignment variances or ongoing territorial boundary delineations.",
  "Baay-Licuan vs Lacub vs Malibcong": "This area represents an overlapping boundary polygon within the CAD dataset, denoting an administrative boundary overlap between the municipalities of Baay-Licuan, Lacub, and Malibcong in the province of Abra. Such polygons account for historical data alignment variances or ongoing territorial boundary delineations."
};

Object.assign(APP, {
  /* ── Info Panel ───────────────────────────── */
  openPanel(feature, level) {

    const panel = document.getElementById('info-panel');
    const content = document.getElementById('info-panel-content');
    if (!panel || !content) return;
    
    this._updatePanelHeader();
    document.body.classList.add('panel-open');
    this.state.lastViewed = { feature, level };

    let name = this._toTitleCase(this._featureName(feature, level));
    if (level === 0) name = "Cordillera Administrative Region";
    const p = feature.properties || {};

    const hero = document.getElementById('panel-hero');
    if (hero) {
      hero.className = 'panel-hero';
      hero.innerHTML = `<div class="panel-level-badge">${this._src().levelNames[level]}</div>
        <h2 class="panel-title">${this._escHtml(name)}</h2>
        <p class="panel-subtitle">Administrative Boundary</p>`;
    }

    let html = '';


    /* 2. Details Section (Stats) */
    html += `<div class="panel-section">
      <div class="panel-section-title">Details</div>
      <div class="stat-grid">`;
    
    const details = this._resolveDetails(p, level, name);
    Object.entries(details).forEach(([k, v]) => {
      html += `<div class="stat-box" style="padding: 0.75rem 1rem;">
        <div class="stat-label" style="font-size: 0.7rem;">${this._escHtml(k)}</div>
        <div class="stat-value" style="font-size: 0.85rem;">${k === 'Size' ? this._escHtml(v) : this._escHtml(v)}</div>
      </div>`;
    });
    html += `</div>`;

    /* Resolve ID for lookups */
    let id = p._id;
    if (!id && level >= 1) {
      const name = this._featureName(feature, level).toLowerCase().replace(/\s+/g, '-');
      if (level === 1) {
        id = name;
      } else if (level === 2) {
        const prov = (p.Province || p.PROVINCE || '').toLowerCase().replace(/\s+/g, '-');
        id = prov ? `${prov}:${name}` : name;
      }
    } else if (level === 0) {
      id = "CAR";
    }

    /* 3. Region Description (State A only) */
    const overviewText = BOUNDARY_OVERVIEWS[name] || `The Cordillera Administrative Region (CAR) is a landlocked, mountainous region in northern Luzon, Philippines. It is the country's only entirely landlocked region, bordered by the Ilocos Region to the west and the Cagayan Valley to the east.`;

    if (level === 0) {
      html += `
        <div class="panel-section-title" style="margin-top: 16px;">Region Overview</div>
        <p style="font-size: 0.85rem; color: #374151; line-height: 1.6; margin-bottom: 0; margin-top: 8px;">
          ${overviewText}
        </p>
      </div>`;
    } else {
      html += `</div>`;
    }

    /* 4. Sub-Features Accordion / List */
    if (level < this._src().maxLevel && this.state.hierarchy && this.state.hierarchy.children && id && this.state.hierarchy.children[id]) {
      const childrenIds = this.state.hierarchy.children[id];
      if (childrenIds.length > 0) {
        const childLevelName = this._src().levelNames[level + 1];
        const pluralName = childLevelName === 'Municipality' ? 'Municipalities' : `${childLevelName}s`;
        
        if (level === 0) {
          html += `<div class="panel-section">
            <div class="panel-section-title">Provinces</div>
            <div class="basin-picker-list">
              ${[...childrenIds].sort((a, b) => a.localeCompare(b)).map(childId => {
                const childName = this.state.hierarchy.names[childId] || childId;
                const slug = childName.toLowerCase().replace(/\s+/g, '-');
                const muniCount = this.state.hierarchy.children[slug]?.length || 0;
                
                let areaM2 = 0;
                if (this.state.rawData[1]) {
                  const pFeature = this.state.rawData[1].features.find(f => this._featureName(f, 1).toLowerCase() === childName.toLowerCase());
                  if (pFeature) {
                    areaM2 = parseFloat(pFeature.properties.Shape_Area || pFeature.properties.AREA || 0);
                  }
                }
                const areaStr = areaM2 > 0 ? (areaM2 / 1000000).toLocaleString(undefined, {maximumFractionDigits:0}) + ' km²' : '';
                
                return `<button class="basin-picker-item" onclick="APP._drillBoundaryFromPicker('${this._escHtml(childName)}', 1)">
                  <div class="basin-picker-info">
                    <span class="basin-picker-name">${this._escHtml(this._toTitleCase(childName))}</span>
                    <span class="basin-picker-meta">
                      ${muniCount ? `<span class="basin-size">${muniCount} municipalities</span>` : ''}
                      ${areaStr ? `<span class="basin-area">${areaStr}</span>` : ''}
                    </span>
                  </div>
                  <svg class="basin-picker-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
                </button>`;
              }).join('')}
            </div>
          </div>`;
        } else {
          html += `<div class="panel-section">
            <div class="span-group collapsed">
              <div class="span-group-label" onclick="this.parentElement.classList.toggle('collapsed')">
                ${pluralName} <span class="span-count-badge" style="padding: 2px 6px;">${childrenIds.length}</span>
              </div>
              <div class="span-group-wrapper">
                <div class="span-group-content">
                  <div class="span-group-enclosed province-accordion-list" style="display: flex; flex-wrap: wrap; gap: 4px; padding: 8px 12px;">
                    ${childrenIds.map(childId => {
                      const childName = this.state.hierarchy.names[childId] || childId;
                      return `<button class="span-chip" onclick="APP._highlightSidebarSelection('${this._escHtml(childName)}', ${level + 1}, this)">
                        ${this._escHtml(this._toTitleCase(childName))}
                      </button>`;
                    }).join('')}
                  </div>
                </div>
              </div>
            </div>
            <p class="span-hint">Tap an item to explore its boundaries.</p>
          </div>`;
        }
      }
    }

    /* 5. Watersheds Section */
    let intersectingWs = null;
    if (level >= 1 && this.state.watershedIntersections && id && this.state.watershedIntersections[id]) {
      intersectingWs = this.state.watershedIntersections[id];
    } else if (level === 0 && this.state.rawData['watershed']) {
      intersectingWs = this.state.rawData['watershed'].features
        .map(f => f.properties.Name || f.properties.Old_Name)
        .filter(Boolean);
    }

    if (level === 0) {
      if (intersectingWs && intersectingWs.length > 0) {
        html += `<div class="panel-section" style="border-top: 1px solid #e5e7eb; padding-top: 16px; margin-top: 16px;">
          <div class="panel-section-title">Watersheds</div>
          <p style="font-size: 0.85rem; color: #374151; line-height: 1.6; margin-bottom: 12px;">
            The Cordillera Administrative Region is a vital watershed for northern Luzon, intersecting with 14 major river basins that supply water for irrigation, hydroelectric power, and domestic use across multiple provinces.
          </p>
          <div class="panel-section-title" style="margin-top: 16px;">4 Major Basins</div>
          <div class="watershed-summary-list">
            ${(intersectingWs).slice(0, 4).map(ws => {
              let areaText = '', outflowText = '';
              if (this.state.rawData['watershed']) {
                const wsFeature = this.state.rawData['watershed'].features.find(f => (f.properties.Name || f.properties.Old_Name || '') === ws);
                if (wsFeature && wsFeature.properties.Area_Ha) areaText = `<span class="ws-area">${wsFeature.properties.Area_Ha.toLocaleString(undefined, {maximumFractionDigits:0})} Ha</span>`;
                outflowText = this.config.watershedConnections[ws] || '';
              }
              return `<div class="watershed-summary-item" style="cursor: pointer;" onclick="APP._highlightWatershedPolygon('${this._escHtml(ws)}')">
                <div class="ws-summary-name">${this._escHtml(ws)}</div>
                <div class="ws-summary-meta">${areaText}${outflowText ? `<span class="ws-outflow-inline">→ ${this._escHtml(outflowText)}</span>` : ''}</div>
              </div>`;
            }).join('')}`;
            
        if (intersectingWs.length > 4) {
          const hiddenPills = intersectingWs.slice(4).map(ws => {
              let areaText = '', outflowText = '';
              if (this.state.rawData['watershed']) {
                const wsFeature = this.state.rawData['watershed'].features.find(f => (f.properties.Name || f.properties.Old_Name || '') === ws);
                if (wsFeature && wsFeature.properties.Area_Ha) areaText = `<span class="ws-area">${wsFeature.properties.Area_Ha.toLocaleString(undefined, {maximumFractionDigits:0})} Ha</span>`;
                outflowText = this.config.watershedConnections[ws] || '';
              }
              return `<div class="watershed-summary-item" style="cursor: pointer;" onclick="APP._highlightWatershedPolygon('${this._escHtml(ws)}')">
                <div class="ws-summary-name">${this._escHtml(ws)}</div>
                <div class="ws-summary-meta">${areaText}${outflowText ? `<span class="ws-outflow-inline">→ ${this._escHtml(outflowText)}</span>` : ''}</div>
              </div>`;
          }).join('');
          
          html += `
            <div class="span-group collapsed" style="margin-top: 8px;">
              <div class="span-group-label" onclick="this.parentElement.classList.toggle('collapsed')" style="font-size: 0.85rem; justify-content: center; background: transparent; border: none; color: #0369a1; font-weight: 500; cursor: pointer; display: flex; text-align: center;">
                View all 14 basins
              </div>
              <div class="span-group-wrapper">
                <div class="span-group-content" style="display: flex; flex-direction: column; gap: 8px;">
                  ${hiddenPills}
                </div>
              </div>
            </div>`;
        }
        
        html += `</div></div>`;
      }
    } else {
      const overviewTitle = `${this._src().levelNames[level]} Overview`;
      html += `<div class="panel-section" style="border-top: 1px solid #e5e7eb; padding-top: 16px; margin-top: 16px;">
        <div class="panel-section-title">${overviewTitle}</div>`;
      if (intersectingWs && intersectingWs.length > 0) {
        html += `<div style="font-size: 0.85rem; font-weight: 600; color: #475569; margin-bottom: 8px;">Watersheds Spanned: <span style="background:#e0f2fe; color:#0369a1; padding: 2px 8px; border-radius: 99px; margin-left: 4px;">${intersectingWs.length}</span></div>`;
      }
      html += `<p style="font-size: 0.85rem; color: #374151; line-height: 1.6; margin-bottom: 0;">${overviewText}</p>
      </div>`;

      if (intersectingWs && intersectingWs.length > 0) {
        html += `<div class="panel-section">
          <div class="panel-section-title">Watersheds</div>
          <div class="watershed-summary-list">
            ${intersectingWs.slice(0, 4).map(ws => {
              let areaText = '', outflowText = '';
              if (this.state.rawData['watershed']) {
                const wsFeature = this.state.rawData['watershed'].features.find(f => (f.properties.Name || f.properties.Old_Name || '') === ws);
                if (wsFeature && wsFeature.properties.Area_Ha) areaText = `<span class="ws-area">${wsFeature.properties.Area_Ha.toLocaleString(undefined, {maximumFractionDigits:0})} Ha</span>`;
                outflowText = this.config.watershedConnections[ws] || '';
              }
              return `<div class="watershed-summary-item" style="cursor: pointer;" onclick="APP._highlightWatershedPolygon('${this._escHtml(ws)}')">
                <div class="ws-summary-name">${this._escHtml(ws)}</div>
                <div class="ws-summary-meta">${areaText}${outflowText ? `<span class="ws-outflow-inline">→ ${this._escHtml(outflowText)}</span>` : ''}</div>
              </div>`;
            }).join('')}`;
            
        if (intersectingWs.length > 4) {
          const hiddenPills = intersectingWs.slice(4).map(ws => {
              let areaText = '', outflowText = '';
              if (this.state.rawData['watershed']) {
                const wsFeature = this.state.rawData['watershed'].features.find(f => (f.properties.Name || f.properties.Old_Name || '') === ws);
                if (wsFeature && wsFeature.properties.Area_Ha) areaText = `<span class="ws-area">${wsFeature.properties.Area_Ha.toLocaleString(undefined, {maximumFractionDigits:0})} Ha</span>`;
                outflowText = this.config.watershedConnections[ws] || '';
              }
              return `<div class="watershed-summary-item" style="cursor: pointer;" onclick="APP._highlightWatershedPolygon('${this._escHtml(ws)}')">
                <div class="ws-summary-name">${this._escHtml(ws)}</div>
                <div class="ws-summary-meta">${areaText}${outflowText ? `<span class="ws-outflow-inline">→ ${this._escHtml(outflowText)}</span>` : ''}</div>
              </div>`;
          }).join('');
          
          html += `
            <div class="span-group collapsed" style="margin-top: 8px;">
              <div class="span-group-label" onclick="this.parentElement.classList.toggle('collapsed')" style="font-size: 0.85rem; justify-content: center; background: #f8fafc; border: 1px dashed #cbd5e1; color: #475569;">
                + ${intersectingWs.length - 4} more
              </div>
              <div class="span-group-wrapper">
                <div class="span-group-content">
                  ${hiddenPills}
                </div>
              </div>
            </div>`;
        }
        
        html += `</div></div>`;
      }
    }

    /* Add Show More Button and Expanded Content — for drilling into specific admin boundaries */
    let expandedHtml = '';
    if (level >= 1 && this.state.watershedIntersections && id && this.state.watershedIntersections[id]) {
      const wsForCheckboxes = this.state.watershedIntersections[id];
      if (wsForCheckboxes.length > 0) {
        expandedHtml = `<div class="expanded-content">
          <div class="panel-section-title">Overlay on Map <span style="background:#e0f2fe; color:#0369a1; padding: 2px 8px; border-radius: 99px; font-size: 0.75rem; font-weight: 600; margin-left: 6px; vertical-align: middle;">${wsForCheckboxes.length}</span></div>
          <p style="font-size: 0.85rem; color: #6b7280; margin-bottom: 12px; margin-top: -4px;">Toggle watersheds to highlight them on the map:</p>
          <div class="watershed-list">
            ${wsForCheckboxes.map(ws => {
              let areaText = '';
              if (this.state.rawData['watershed']) {
                const wsFeature = this.state.rawData['watershed'].features.find(f => {
                  const n = f.properties.Name || f.properties.Old_Name || '';
                  return n === ws;
                });
                if (wsFeature && wsFeature.properties.Area_Ha) {
                  areaText = `<span style="font-size: 0.8rem; color: #6b7280; margin-left: auto;">${wsFeature.properties.Area_Ha.toLocaleString(undefined, {maximumFractionDigits:0})} Ha</span>`;
                }
              }
              return `
              <div class="watershed-list-item">
                <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; width: 100%;">
                  <input type="checkbox" class="panel-ws-checkbox" value="${this._escHtml(ws)}" onchange="APP.updateWatersheds(this)" ${this.state.activeWatershedIds && this.state.activeWatershedIds.includes(ws) ? 'checked' : ''} style="accent-color: #0284c7; width: 16px; height: 16px;">
                  <span style="font-weight: 500;">${this._escHtml(ws)}</span>
                  ${areaText}
                </label>
              </div>`;
            }).join('')}
          </div>
        </div>`;

        html += `<div class="panel-show-more">
          <button class="show-more-btn view-ws-btn" onclick="APP.toggleExpandedPanel()">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:6px;"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            View Watersheds on Map (${wsForCheckboxes.length})
          </button>
        </div>`;
        html += expandedHtml;
      }
    }

    content.innerHTML = html;
    
    requestAnimationFrame(() => {
      if (content) content.scrollTop = 0;
    });

    panel.classList.remove('open', 'closed', 'peek');
    panel.classList.add('open');
    this.state.panelState = 'open';
    document.body.classList.add('panel-open');

    /* Hide toggle tab when panel is open */
    const tab = document.getElementById('panel-toggle-tab');
    if (tab) tab.classList.add('hidden');


  },

  closePanel() {
    const panel = document.getElementById('info-panel');
    if (!panel) return;
    
    panel.classList.remove('open', 'expanded', 'peek');
    panel.classList.add('closed');
    this.state.panelState = 'closed';
    document.body.classList.remove('panel-open', 'panel-expanded');
    const tab = document.getElementById('panel-toggle-tab');
    if (tab) tab.classList.remove('hidden');

    this._updatePanelToggleIcon();
  },

  togglePanel() {
    const panel = document.getElementById('info-panel');
    if (!panel) return;
    const isMobile = window.innerWidth <= 640;
    
    if (isMobile) {
      if (panel.classList.contains('open')) {
        this.closePanel();
      } else if (panel.classList.contains('peek')) {
        panel.classList.remove('peek', 'closed');
        panel.classList.add('open');
        document.body.classList.add('panel-open');
      } else {
        panel.classList.remove('closed');
        panel.classList.add('peek');
        this.state.panelState = 'peek';
        this._updatePanelToggleIcon();
      }
    } else {
      if (panel.classList.contains('open')) {
        this.closePanel();
      } else {
        // Just slide it open without destroying the DOM
        panel.classList.remove('closed', 'peek');
        panel.classList.add('open');
        this.state.panelState = 'open';
        document.body.classList.add('panel-open');
        this._updatePanelToggleIcon();
        
        // If the panel is completely empty (e.g. first load), show default fallback
        const content = document.getElementById('info-panel-content');
        if (!content || !content.innerHTML.trim()) {
          const carData = this.state.rawData[0];
          if (carData && carData.features) {
            this.openPanel(carData.features[0], 0);
          }
        }
      }
    }
  },

  /* Sync the left-edge toggle tab visibility with current panel state.
     Tab is visible when panel is closed; hidden when open or peeking. */
  _updatePanelToggleIcon() {
    const tab = document.getElementById('panel-toggle-tab');
    if (!tab) return;
    const panel = document.getElementById('info-panel');
    const isOpen = panel && (panel.classList.contains('open') || panel.classList.contains('peek'));
    tab.classList.toggle('hidden', isOpen);
  },

  toggleExpandedPanel(skipPan = false) {
    const panel = document.getElementById('info-panel');
    const btn = document.querySelector('.show-more-btn');
    if (!panel) return;
    const isExpanded = panel.classList.contains('expanded');
    
    const panelCheckboxes = panel.querySelectorAll('.panel-ws-checkbox');

    if (isExpanded) {
      panel.classList.remove('expanded');
      document.body.classList.remove('panel-expanded');
      if (btn) btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:6px;"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg> View Watersheds on Map`;
      
      /* Turn off all visible watersheds in the panel */
      const promises = [];
      panelCheckboxes.forEach(cb => {
        if (cb.checked) {
          cb.checked = false;
          cb.dataset.autoChecked = 'false';
          promises.push(this.updateWatersheds(cb));
        }
      });
      
      Promise.all(promises).then(() => {
        if (skipPan) return;
        if (this.state._selectedLeafletLayer && this.state._selectedLeafletLayer.getBounds) {
          this.state.map.flyToBounds(this.state._selectedLeafletLayer.getBounds(), {
            ...this._getPaddingOpts(),
            duration: 0.45,
            easeLinearity: 0.25
          });
        }
      });
    } else {
      panel.classList.add('expanded');
      document.body.classList.remove('panel-expanded');
      document.body.classList.add('panel-expanded');
      if (btn) btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:6px;"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg> Hide Watersheds`;
      
      /* Turn on all unchecked watersheds */
      const promises = [];
      panelCheckboxes.forEach(cb => {
        if (!cb.checked) {
          cb.checked = true;
          cb.dataset.autoChecked = 'true';
          promises.push(this.updateWatersheds(cb));
        }
      });
      
      Promise.all(promises).then(() => {
        if (skipPan) return;
        if (this.state.watershedLayer && this.state.activeWatershedIds.length > 0) {
          let activeBounds = L.latLngBounds([]);
          this.state.watershedLayer.eachLayer(layer => {
            const name = layer.feature.properties.Name || layer.feature.properties.Old_Name || '';
            if (this.state.activeWatershedIds.includes(name)) {
              activeBounds.extend(layer.getBounds());
            }
          });
          
          if (activeBounds.isValid()) {
            this.state.map.flyToBounds(activeBounds, {
              ...this._getPaddingOpts(),
              duration: 0.45,
              easeLinearity: 0.25
            });
          }
        }
      });
    }
  },

  _resolveDetails(props, level, name) {
    const d = {};
    if (level === 0) {
      d['Island Group'] = 'Luzon';
    } else if (level === 1) {
      d['Region'] = 'Cordillera Administrative Region';
    } else if (level === 2) {
      const parentName = this._toTitleCase(props.Province || props.PROVINCE || props.Muni_City || '');
      if (parentName) d['Province'] = parentName;
    }

    let hectares = 0;
    if (props.Shape_Area) {
      hectares = parseFloat(props.Shape_Area) / 10000;
    } else if (props.Hectares) {
      hectares = parseFloat(props.Hectares);
    } else if (props.AREA) {
      hectares = parseFloat(props.AREA);
    } else if (props.Area) {
      hectares = parseFloat(props.Area);
    }
    
    if (hectares > 0) {
      let sizeCategory = '';
      if (level === 2) {
        if (hectares < 10000) sizeCategory = 'Small';
        else if (hectares <= 50000) sizeCategory = 'Medium';
        else sizeCategory = 'Large';
        d['Size'] = `${sizeCategory} sized municipality`;
      } else if (level === 1) {
        if (hectares < 100000) sizeCategory = 'Small';
        else if (hectares <= 300000) sizeCategory = 'Medium';
        else sizeCategory = 'Large';
        d['Size'] = `${sizeCategory} sized province`;
      } else {
        d['Size'] = `Large sized region`;
      }
      d['Area (Ha)'] = hectares.toLocaleString(undefined, { maximumFractionDigits: 2 });
    }

    let perimeterKm = 0;
    if (props.Shape_Length) {
      perimeterKm = parseFloat(props.Shape_Length) / 1000;
    } else if (props.Perimeter) {
      perimeterKm = parseFloat(props.Perimeter);
    } else if (props.Length) {
      perimeterKm = parseFloat(props.Length);
    } else if (props.PERIMETER) {
      perimeterKm = parseFloat(props.PERIMETER);
    }

    if (perimeterKm > 0 || level === 0) {
      d['Perimeter (km)'] = perimeterKm > 0 ? perimeterKm.toLocaleString(undefined, { maximumFractionDigits: 2 }) : 'N/A';
    }
    
    return d;
  },

  _resolveChartData(props) {
    const labels = [], values = [];
    const sqMeters = parseFloat(props.Shape_Area || props.AREA || 0);
    if (sqMeters > 0) { labels.push('Square Meters'); values.push(sqMeters); }
    
    let hectares = parseFloat(props.Hectares || props.Area || 0);
    if (hectares <= 0 && sqMeters > 0) hectares = sqMeters / 10000;
    if (hectares > 0) { labels.push('Hectares'); values.push(hectares); }
    
    const perimeter = parseFloat(props.Shape_Length || props.PERIMETER || 0);
    if (perimeter > 0) { labels.push('Perimeter'); values.push(perimeter); }
    
    return { labels, values };
  },

  /* Build a summary of the currently selected feature for the data request form */
  _buildDataSummary(feature, level, panelType) {
    const p = feature.properties || {};
    const src = this._src();
    let typeLabel = '', name = '', details = [];

    if (panelType === 'watershed') {
      typeLabel = 'Watershed Basin';
      name = p.Name || p.Old_Name || 'Unknown Watershed';
      if (p.WSID) details.push('ID: ' + p.WSID);
      if (p.Area_Ha) details.push('Area: ' + p.Area_Ha.toLocaleString(undefined, {maximumFractionDigits:2}) + ' Ha');
      if (p.SIZE_W) details.push('Size: ' + p.SIZE_W);
      const outflow = this.config.watershedConnections[name];
      if (outflow) details.push('Outflow: ' + outflow);
    } else if (panelType === 'subwatershed') {
      typeLabel = 'Sub-watershed Zone';
      const gc = p.gridcode != null ? p.gridcode : '?';
      name = 'Zone ' + gc;
      if (this.state.hydroSelectedBasin) {
        details.push('Basin: ' + this.state.hydroSelectedBasin.name);
      }
      const areaM2 = parseFloat(p.Shape_Area || 0);
      if (areaM2 > 0) details.push('Area: ' + (areaM2 / 10000).toLocaleString(undefined, {maximumFractionDigits:2}) + ' Ha');
      if (gc != null) details.push('Zone Code: ' + gc);
    } else if (panelType === 'general') {
      typeLabel = 'General Map Data';
      name = 'General Enquiry';
      details.push('Please specify exactly what data you need in the notes below.');
    } else {
      typeLabel = src.levelNames[level] || 'Boundary';
      name = this._toTitleCase(this._featureName(feature, level));
      details.push('Source: ' + src.label);
      details.push('Data Level: ' + src.levelNames[level]);
      const areaM2 = parseFloat(p.Shape_Area || p.AREA || 0);
      if (areaM2 > 0) details.push('Area: ' + (areaM2 / 10000).toLocaleString(undefined, {maximumFractionDigits:2}) + ' Ha');
      const hectares = parseFloat(p.Hectares || p.Area || 0);
      if (hectares > 0) details.push('Area (Ha): ' + hectares.toLocaleString(undefined, {maximumFractionDigits:2}));
      if (p._id) details.push('Reference ID: ' + p._id);
    }

    return { typeLabel, name, details };
  },

  /* Open the data request form for the currently selected feature */
  _openRequestFromToolbar() {
    if (this.state.viewMode === 'watersheds') {
      if (this.state.hydroSelectedZone && this.state.hydroSelectedZone.feature) {
        return this._showDataRequestForm(this.state.hydroSelectedZone.feature, 0, 'subwatershed');
      }
      if (this.state.hydroSelectedBasin && this.state.hydroSelectedBasin.feature) {
        return this._showDataRequestForm(this.state.hydroSelectedBasin.feature, 0, 'watershed');
      }
    } else {
      const lastSelected = this.state.selectedPath && this.state.selectedPath[this.state.selectedPath.length - 1];
      if (lastSelected && lastSelected.feature) {
        return this._showDataRequestForm(lastSelected.feature, this.state.currentLevel, 'boundary');
      }
    }
    this._showDataRequestForm({}, 0, 'general');
  },

  _showDataRequestForm(feature, level, panelType) {
    const existing = document.querySelector('.data-request-overlay');
    if (existing) existing.remove();

    const summary = this._buildDataSummary(feature, level, panelType);

    const overlay = document.createElement('div');
    overlay.className = 'data-request-overlay';
    overlay.innerHTML = [
      '<div class="data-request-modal">',
      '  <div class="data-request-header">',
      '    <h3>Request Data<small>Submit an enquiry to obtain this geographic data</small></h3>',
      '    <button class="data-request-close" onclick="APP._closeDataRequest()" aria-label="Close">',
      '      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
      '    </button>',
      '  </div>',
      '  <div class="data-request-body">',
      '    <div class="data-request-object">',
      '      <div class="data-request-object-label">Selected Object</div>',
      '      <div class="data-request-object-name">' + this._escHtml(summary.name) + '</div>',
      '      <div class="data-request-object-meta">',
      '        <span>Type: ' + this._escHtml(summary.typeLabel) + '</span>',
             summary.details.map(function(d) { return '<span>' + this._escHtml(d) + '</span>'; }.bind(this)).join(''),
      '      </div>',
      '    </div>',
      '    <div class="form-row">',
      '      <div class="form-group">',
      '        <label>Full Name <span class="required">*</span></label>',
      '        <input type="text" id="dr-name" placeholder="e.g. Juan Dela Cruz" required>',
      '      </div>',
      '      <div class="form-group">',
      '        <label>Email Address <span class="required">*</span></label>',
      '        <input type="email" id="dr-email" placeholder="e.g. juan@example.com" required>',
      '      </div>',
      '    </div>',
      '    <div class="form-group">',
      '      <label>Affiliation / Organization</label>',
      '      <input type="text" id="dr-org" placeholder="e.g. DENR, NAMRIA, University, Private Sector">',
      '    </div>',
      '    <div class="form-group">',
      '      <label>Purpose of Request <span class="required">*</span></label>',
      '      <select id="dr-purpose" required>',
      '        <option value="">Select purpose\u2026</option>',
      '        <option value="Academic Research">Academic Research</option>',
      '        <option value="Environmental Planning">Environmental Planning</option>',
      '        <option value="Policy Development">Policy Development</option>',
      '        <option value="Infrastructure Project">Infrastructure Project</option>',
      '        <option value="Disaster Risk Reduction">Disaster Risk Reduction</option>',
      '        <option value="Resource Management">Resource Management</option>',
      '        <option value="Personal / Educational">Personal / Educational</option>',
      '        <option value="Other">Other</option>',
      '      </select>',
      '    </div>',
      '    <div class="form-group">',
      '      <label>Additional Notes / Specific Data Requirements</label>',
      '      <textarea id="dr-notes" placeholder="Describe the specific data you need, preferred format (e.g. Shapefile, GeoJSON), coordinate system, etc."></textarea>',
      '    </div>',
      '  </div>',
      '  <div class="data-request-footer">',
      '    <button class="btn-secondary" onclick="APP._closeDataRequest()">Cancel</button>',
      '    <button class="btn-primary" onclick="APP._submitDataRequest()">',
      '      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>',
      '      Send Request via Email',
      '    </button>',
      '  </div>',
      '</div>'
    ].join('\n');

    document.body.appendChild(overlay);
    overlay.offsetHeight;
    overlay.classList.add('show');
  },

  _closeDataRequest() {
    var overlay = document.querySelector('.data-request-overlay');
    if (overlay) {
      overlay.classList.remove('show');
      setTimeout(function() { overlay.remove(); }, 250);
    }
  },

  _submitDataRequest() {
    var name = document.getElementById('dr-name');
    var email = document.getElementById('dr-email');
    var org = document.getElementById('dr-org');
    var purpose = document.getElementById('dr-purpose');
    var notes = document.getElementById('dr-notes');

    if (!name || !name.value.trim()) {
      if (name) { name.focus(); name.style.borderColor = '#dc2626'; }
      return;
    }
    if (!email || !email.value.trim() || !email.value.includes('@')) {
      if (email) { email.focus(); email.style.borderColor = '#dc2626'; }
      return;
    }
    if (!purpose || !purpose.value) {
      if (purpose) { purpose.focus(); purpose.style.borderColor = '#dc2626'; }
      return;
    }

    var objNameEl = document.querySelector('.data-request-object-name');
    var objMetaEl = document.querySelector('.data-request-object-meta');
    var objectName = objNameEl ? objNameEl.textContent.trim() : 'Unspecified';
    var objectMeta = objMetaEl ? objMetaEl.textContent.trim() : '';

    var subject = encodeURIComponent('Data Request: ' + objectName + ' \u2014 DENR CAR GeoPortal');
    var bodyLines = [
      'Good day,',
      '',
      'I would like to request geographic data from the DENR CAR Watershed Monitoring portal.',
      '',
      '--- Request Details ---',
      'Requested Object: ' + objectName,
      'Object Info: ' + objectMeta,
      '',
      '--- Requestor Information ---',
      'Name: ' + name.value.trim(),
      'Email: ' + email.value.trim(),
      'Organization: ' + (org ? org.value.trim() || 'Not specified' : 'Not specified'),
      'Purpose: ' + purpose.value,
      '',
      '--- Additional Notes ---',
      (notes ? notes.value.trim() || 'None' : 'None'),
      '',
      '---',
      'This request was submitted via the DENR CAR Watershed Monitoring GeoPortal.',
      'https://geo-monitor-ten.vercel.app',
    ];
    var body = encodeURIComponent(bodyLines.join('\n'));

    var recipient = this.config.dataRequestEmail || 'car@denr.gov.ph';
    window.location.href = 'mailto:' + recipient + '?subject=' + subject + '&body=' + body;
    this._closeDataRequest();
  },

  /* Highlight a specific watershed on the map when clicked from the Boundary panel */
  _highlightWatershedPolygon(wsName) {
    if (!this.state.rawData['watershed']) return;

    if (this.state._wsHighlightLayer && this.state._wsHighlightName === wsName) {
      this.state.map.removeLayer(this.state._wsHighlightLayer);
      this.state._wsHighlightLayer = null;
      this.state._wsHighlightName = null;
      
      if (this.state.selectedPath && this.state.selectedPath.length > 0) {
        const p = this.state.selectedPath[this.state.selectedPath.length - 1];
        if (p.layer && p.layer.getBounds) {
          try { this.state.map.flyToBounds(p.layer.getBounds(), { padding: [20, 20], duration: 0.8 }); } catch(e){}
        }
      } else if (this.state.layers && this.state.layers[0]) {
        try { this.state.map.flyToBounds(this.state.layers[0].getBounds(), { padding: [20, 20], duration: 0.8 }); } catch(e){}
      }
      
      return;
    }

    const wsFeature = this.state.rawData['watershed'].features.find(f => {
      const n = f.properties.Name || f.properties.Old_Name || '';
      return n === wsName;
    });
    if (!wsFeature) return;

    if (this.state._wsHighlightLayer && this.state.map) {
      this.state.map.removeLayer(this.state._wsHighlightLayer);
    }

    this.state._wsHighlightLayer = L.geoJSON(wsFeature, {
      interactive: false,
      style: { color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.2, weight: 2, dashArray: '5, 5' }
    }).addTo(this.state.map);
    this.state._wsHighlightName = wsName;
    this.state._wsHighlightLayer.bringToFront();
    
    if (this.state._wsHighlightLayer.getBounds) {
      try {
        this.state.map.flyToBounds(this.state._wsHighlightLayer.getBounds(), { ...this._getPaddingOpts(), duration: 0.45 });
      } catch (e) {}
    }
  },

  /* Force Zone A (the white header bar) to match the current global mode.
     Called at the top of every panel-open method so the header is never stale. */
  _updatePanelHeader() {
    const mode = this.state.viewMode;
    const labelEl = document.getElementById('panel-header-label');
    if (labelEl) {
      labelEl.textContent = mode === 'watersheds' ? 'Watershed Monitor' : 'Boundary Explorer';
    }
    const iconEl = document.getElementById('panel-header-icon');
    if (iconEl) {
      iconEl.innerHTML = mode === 'watersheds'
        ? '<path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/>'
        : '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>';
    }
  }
});

// Legacy shims
function initDashboard() {}
function updateDashboard(feature) { if (feature && APP) APP.openPanel(feature, APP.state.currentLevel); }
function clearDashboard() { APP.closePanel(); }
