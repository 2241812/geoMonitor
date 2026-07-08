import { APP } from './app.js';
/**
 * config.js
 * Centralized configuration for map bounds, sources, and colors.
 */

Object.assign(APP, {
  config: {
    mapCenter: [17.3, 121.0],
    mapZoom: 8.5,
    minZoom: 5,
    maxZoom: 18,
    maxBounds: [[4.0, 116.0], [21.5, 128.0]],

    sources: {
      namria: {
        label: 'NAMRIA',
        geoJSON: {
          0: 'geoJSON/Overlays/namria_region.json',
          1: 'geoJSON/Overlays/namria_province.json',
          2: 'geoJSON/Overlays/namria_municipality.json',
        },
        hierarchy: 'geoJSON/hierarchy-namria.json',
        levelNames: ['Region', 'Province', 'Municipality'],
        maxLevel: 2,
      },
      cad: {
        label: 'CAD',
        geoJSON: {
          0: 'geoJSON/Overlays/cad_region.json',
          1: 'geoJSON/Overlays/cad_province.json',
          2: 'geoJSON/Overlays/cad_municipality.json',
        },
        hierarchy: 'geoJSON/hierarchy-cad.json',
        levelNames: ['Region', 'Province', 'Municipality'],
        maxLevel: 2,
      },
    },

    colors: {
      0: { fill: '#059669', stroke: '#0f172a', weight: 2.5 },
      1: { fill: '#2563eb', stroke: '#000000', weight: 2 },
      2: { fill: '#d97706', stroke: '#000000', weight: 1.5 },
      highlight: { fill: '#000000', stroke: '#000000', weight: 3 },
      watershed: { fill: '#0ea5e9', stroke: '#0284c7', weight: 2, fillOpacity: 0.35 },
      watershedHighlight: { fill: '#0ea5e9', stroke: '#0369a1', weight: 4, fillOpacity: 0.55 },
    },

    watershedConnections: {
      "Abra River Watershed": "West Philippine Sea",
      "Abulug River Watershed": "Babuyan Channel",
      "Agno River Watershed": "Lingayen Gulf",
      "Amburayan River Watershed": "South China Sea",
      "Aringay River Watershed": "Lingayen Gulf",
      "Bayogao River Watershed": "South China Sea",
      "Bued River Watershed": "Lingayen Gulf",
      "Cabicungan River Watershed": "Babuyan Channel",
      "Mallig River Watershed": "Cagayan River",
      "Naguilian River Watershed": "West Philippine Sea",
      "Santa Maria River Watershed": "West Philippine Sea",
      "Siffu River Watershed": "Cagayan River",
      "Upper Chico River Watershed": "Cagayan River",
      "Upper Magat River Watershed": "Cagayan River",
      "Zumigui-Ziwanan River Watershed": "Babuyan Channel"
    },

    watershedDescriptions: {
      "Upper Chico River Watershed": "The Upper Chico River Watershed is a major headwater system for the Chico River, flowing through the Cordillera mountains and primarily draining into the Cagayan River Basin. It plays a critical role in supporting local agriculture and the region's indigenous communities.",
      "Upper Magat River Watershed": "This watershed forms the upper reaches of the Magat River, a vital tributary of the Cagayan River. It is characterized by steep mountainous terrain and is essential for supplying water to the Magat Dam, which supports large-scale irrigation and hydroelectric power generation.",
      "Siffu River Watershed": "The Siffu River Watershed spans the eastern slopes of the Cordillera Central, eventually draining into the Magat River. It serves as an important agricultural water source for the surrounding lowland communities.",
      "Mallig River Watershed": "A significant sub-basin of the Cagayan River system, the Mallig River Watershed covers portions of Kalinga and Mountain Province, delivering vital surface water to the agricultural plains below.",
      "Zumigui-Ziwanan River Watershed": "Also known as the Pamplona or Manucotae watershed, this river system primarily drains northward towards the Babuyan Channel. It features dense forest cover and is critical for maintaining the region's hydrological balance.",
      "Abra River Watershed": "The Abra River Watershed is the largest river basin in the Ilocos Region, originating from the slopes of Mount Data in the Cordillera Central. It carves a deep valley westward before emptying into the West Philippine Sea.",
      "Naguilian River Watershed": "The Naguilian River Watershed flows westward from the mountains of Benguet, directly draining into the West Philippine Sea. It is a smaller but essential basin supporting local municipalities along the La Union coast.",
      "Aringay River Watershed": "Originating from the rugged terrains of Benguet, the Aringay River Watershed runs westward into the Lingayen Gulf. The basin is characterized by varied topography and supports diverse local ecosystems.",
      "Zumiqui-Ziwanan River Watershed": "Pamplona River",
      "Abulug River Watershed": "The Abulug River Watershed is the second largest river system in the Cagayan Valley region, originating from the Apayao highlands and draining northward into the Babuyan Channel. It plays a critical role in supporting diverse ecosystems and local agricultural irrigation.",
      "Agno River Watershed": "Originating from the slopes of Mount Data, the Agno River Watershed is one of the largest river systems in Luzon. It flows southward through the Cordillera mountains before winding its way across the plains of Pangasinan to drain into the Lingayen Gulf, providing vital hydroelectric power and irrigation.",
      "Amburayan River Watershed": "The Amburayan River flows from the tri-boundary of Benguet, La Union, and Ilocos Sur, serving as a historic natural boundary. It empties into the South China Sea and is essential for the region's agricultural plains and surrounding communities.",
      "Bayogao River Watershed": "The Bayogao River Watershed is a coastal basin situated along the western slopes of the Cordillera mountains, draining directly into the South China Sea. It provides critical water resources for local coastal municipalities.",
      "Bued River Watershed": "The Bued River Watershed originates in the mountains of Baguio City and flows down through Benguet and Pangasinan to the Lingayen Gulf. The basin is characterized by steep slopes and is a key water source for surrounding urban and rural areas.",
      "Cabicungan River Watershed": "The Cabicungan River Watershed spans the northern territories of Apayao, draining towards the Babuyan Channel. It supports dense forest cover and rich biodiversity in the northernmost reaches of the Cordillera.",
      "Santa Maria River Watershed": "The Santa Maria River Watershed flows through the western slopes of the Cordilleras and into the Ilocos region, discharging into the West Philippine Sea. It sustains the agricultural livelihoods of downstream communities."
    },

    /* Maps each watershed Name to its subfolder + code for fetching sub-watershed/stream GeoJSON */
    hydroBasinFolderMap: {
      "Abra River Watershed": { folder: "Abra Riverbasin", code: "ABR" },
      "Abulug River Watershed": { folder: "Apayao-Abulug Riverbasin", code: "ABU" },
      "Agno River Watershed": { folder: "Agno Riverbasin", code: "AGN" },
      "Bayogao River Watershed": { folder: "Amburayan River", code: "AMB" },
      "Aringay River Watershed": { folder: "Aringay River", code: "ARI" },
      "Bued River Watershed": { folder: "Bued River", code: "BUD" },
      "Cabicungan River Watershed": { folder: "Cabicungan River", code: "CAB" },
      "Mallig River Watershed": { folder: "Mallig River", code: "MLG" },
      "Naguilian River Watershed": { folder: "Naguilian River", code: "NAG" },
      "Siffu River Watershed": { folder: "Siffu River", code: "SIF" },
      "Santa Maria River Watershed": { folder: "Santa Maria River (Silag)", code: "SMR" },
      "Upper Chico River Watershed": { folder: "Upper Chico Riverbasin", code: "UCH" },
      "Upper Magat River Watershed": { folder: "Upper Magat River", code: "UMT" },
      "Zumigui-Ziwanan River Watershed": { folder: "Zumigui-Ziwanan River", code: "ZUM" },
    },

    /* 14-color palette — one per basin, indexed by _hydroBasinIndex() */
    hydroLevelColors: [
      '#e11d48', '#0891b2', '#7c3aed', '#d97706',
      '#059669', '#2563eb', '#db2777', '#0d9488',
      '#ca8a04', '#4f46e5', '#ea580c', '#16a34a',
      '#9333ea', '#0284c7',
    ],

    /* Basin picker groups (by outflow destination) */
    hydroBasinGroups: [
      { title: 'Cagayan River Basin', basins: [
        'Upper Chico River Watershed', 'Upper Magat River Watershed',
        'Siffu River Watershed', 'Mallig River Watershed', 'Zumigui-Ziwanan River Watershed',
      ]},
      { title: 'West Philippine Sea', basins: [
        'Abra River Watershed', 'Bayogao River Watershed',
        'Naguilian River Watershed', 'Aringay River Watershed', 'Santa Maria River Watershed',
      ]},
      { title: 'Lingayen Gulf', basins: [
        'Agno River Watershed', 'Bued River Watershed',
      ]},
      { title: 'Babuyan Channel', basins: [
        'Abulug River Watershed', 'Cabicungan River Watershed',
      ]},
    ],

    baseMaps: {
      osm: {
        url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        attr: '&copy; <a href="https://openstreetmap.org">OpenStreetMap</a> contributors',
      },
      topo: {
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
        attr: 'Tiles &copy; <a href="https://esri.com">Esri</a>',
      },
      satellite: {
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        attr: 'Tiles &copy; <a href="https://esri.com">Esri</a>',
      },
    },

    dataRequestEmail: 'renzoj156@gmail.com',
    dataRequestEndpoint: 'https://script.google.com/macros/s/AKfycbyLldQUH_cxEBWXg8B1mJPnI1DqSqNNHX42_q_WauGVF0nhJLzVXcsrCskuPu5RAa1MLw/exec',

    supabase: {
      url: 'https://micsfokodqqqgwtlctca.supabase.co',
      anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pY3Nmb2tvZHFxcWd3dGxjdGNhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI5NjExNjgsImV4cCI6MjA5ODUzNzE2OH0.zTrxYk4-QJ-nsM_SlcqiA1IR7XpZXpFmjCN2xBQgTY4',
    },
  }
});
