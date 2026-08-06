import { db } from './index';
import {
  users,
  organizations,
  organizationMembers,
  projects,
  zones,
  capturePoints,
  panoramas,
  hotspots,
  notes,
  tradeCatalog,
  subcontractors,
  pointageRecords,
} from './schema';

function generateId(): string {
  return crypto.randomUUID();
}

function parseFrenchDate(dateStr: string): Date | null {
  const monthsFR = [
    'janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin',
    'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.',
  ];
  const monthsEN = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  const match = dateStr.match(/(\d{2})\s+(\w+\.?)\s+(\d{4})/);
  if (!match) return null;
  const day = parseInt(match[1], 10);
  const monthKey = match[2].endsWith('.') ? match[2] : match[2] + '.';
  const monthIndex = monthsFR.indexOf(monthKey);
  if (monthIndex === -1) return null;
  const year = parseInt(match[3], 10);
  return new Date(year, monthIndex, day);
}

function parseBudget(budgetStr: string): number | null {
  const cleaned = budgetStr.replace(/\s/g, '').replace(/MAD$/, '');
  const num = parseInt(cleaned, 10);
  return isNaN(num) ? null : num;
}

function parseSurface(surfaceStr: string): number | null {
  const cleaned = surfaceStr.replace(/\s/g, '').replace(/m²$/, '');
  const num = parseInt(cleaned, 10);
  return isNaN(num) ? null : num;
}

function parseComplianceScore(scoreStr: string): number | null {
  const cleaned = scoreStr.replace(/%$/, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

function parseScheduleDelta(scheduleStr: string): number | null {
  const match = scheduleStr.match(/([+-]?\d+)\s*jours/);
  if (!match) return null;
  return parseInt(match[1], 10);
}

function mapOperationalStatusToLifecycle(status: string): string {
  switch (status) {
    case 'en_cours': return 'in_progress';
    case 'en_retard': return 'in_progress';
    case 'probleme': return 'in_progress';
    case 'termine': return 'completed';
    default: return 'planning';
  }
}

async function seed() {
  console.log('🌱 Starting database seed...');

  // --- Organization ---
  const orgId = generateId();
  await db.insert(organizations).values({
    id: orgId,
    name: 'BuildMaroc',
    slug: 'buildmaroc',
    billingEmail: 'admin@buildmaroc.ma',
  });
  console.log('  ✅ Organization created');

  // --- Default User ---
  const userId = generateId();
  await db.insert(users).values({
    id: userId,
    email: 'admin@buildmaroc.ma',
    fullName: 'Admin BuildMaroc',
    avatarUrl: null,
  });
  console.log('  ✅ Default user created');

  // --- Organization Member (owner) ---
  await db.insert(organizationMembers).values({
    organizationId: orgId,
    userId,
    role: 'owner',
  });
  console.log('  ✅ Organization member created');

  // --- Projects (from INITIAL_CHANTIERS) ---
  const chantierData = [
    {
      id: 'chk-001',
      code: 'CAS-2026-01',
      name: 'Résidence Al Amal',
      location: 'Casablanca',
      address: 'Bd Zerktouni, Maarif, Casablanca',
      lat: 33.589886,
      lng: -7.632512,
      status: 'en_cours' as const,
      progress: 92,
      budget: '42 500 000 MAD',
      spentProgress: 88,
      surface: '14 200 m²',
      workersCount: 48,
      complianceScore: '98.5%',
      scheduleAhead: '+3 jours d\'avance',
      startDate: '15 Jan 2026',
      expectedEndDate: '15 Déc 2026',
      type: 'Résidentiel (R+4)',
      manager: { name: 'Ahmed Benali', role: 'Chef de Projet Senior', phone: '+212 6 61 23 45 67', email: 'a.benali@buildmaroc.ma', avatar: 'AB' },
      weather: 'Casablanca • 24°C Ensoleillé',
      captures: [
        {
          id: 'cap-sem-01',
          week: 'Semaine 01',
          date: '15 Jan 2026',
          progress: 5,
          operator: 'Ahmed Benali',
          note: 'Phase terrassement & fondations. Coulage du radier principal.',
          hotspots: [
            { pitch: -10, yaw: -25, title: 'Coulage Radier Béton B35', text: 'Résistance 35 MPa contrôlée conforme par LPEE.' },
            { pitch: 15, yaw: 45, title: 'Base Grue à Tour G1', text: 'Ancrage sur massif béton armé validé 45m.' },
          ],
          zones: [
            { id: 'complet', name: 'Chantier complet', type: 'complet', pitch: 0, yaw: 0 },
            { id: 'etage1', name: '1er étage', type: 'etage1', pitch: 0, yaw: 30 },
            { id: 'balcon', name: 'Balcon & Façade', type: 'balcon', pitch: -5, yaw: 60 },
          ],
        },
        {
          id: 'cap-sem-20',
          week: 'Semaine 20',
          date: '02 Juin 2026',
          progress: 48,
          operator: 'Karim Tazi',
          note: 'Élévation structure R+4. Poteaux béton et maçonnerie de briques rouges.',
          hotspots: [
            { pitch: 5, yaw: -15, title: 'Voiles Béton Armé R+2', text: 'Ferraillage haute adhérence FeE500 conforme.' },
            { pitch: -5, yaw: 35, title: 'Maçonnerie Briques Rouges 20cm', text: 'Joints mortier ciment d\'épaisseur réglementaire.' },
          ],
          zones: [
            { id: 'complet', name: 'Chantier complet', type: 'complet', pitch: 0, yaw: 0 },
            { id: 'etage1', name: '1er étage', type: 'etage1', pitch: 0, yaw: 30 },
            { id: 'balcon', name: 'Balcon & Façade', type: 'balcon', pitch: -5, yaw: 60 },
          ],
        },
        {
          id: 'cap-sem-40',
          week: 'Semaine 40',
          date: '20 Nov 2026',
          progress: 92,
          operator: 'Ahmed Benali',
          note: 'Enduit de façade achevé. Menuiserie aluminium et finitions intérieures.',
          hotspots: [
            { pitch: -2, yaw: -30, title: 'Menuiserie Aluminium RPT', text: 'Double vitrage 6/12/6 étanchéité à l\'air A4.' },
            { pitch: 8, yaw: 40, title: 'Enduit Monocouche Hydrofuge', text: 'Finition talochée ton pierre conforme aux exigences.' },
          ],
          zones: [
            { id: 'complet', name: 'Chantier complet', type: 'complet', pitch: 0, yaw: 0 },
            { id: 'etage1', name: '1er étage', type: 'etage1', pitch: 0, yaw: 30 },
            { id: 'balcon', name: 'Balcon & Façade', type: 'balcon', pitch: -5, yaw: 60 },
          ],
        },
      ],
      notes: [
        { id: 'note-101', text: 'Livraison des baies vitrées aluminium pour la façade principale effectuée.', author: 'Ahmed Benali', date: '20 Nov 2026 - 14:30', priority: 'normal' as const },
        { id: 'note-102', text: 'Contrôle d\'étanchéité des terrasses du 4ème étage validé avec succès.', author: 'Karim Tazi', date: '18 Nov 2026 - 11:15', priority: 'normal' as const },
      ],
    },
    {
      id: 'chk-002',
      code: 'BOU-2026-04',
      name: 'Villa Bouskoura Golf',
      location: 'Bouskoura',
      address: 'Ville Verte, Bouskoura',
      lat: 33.452120,
      lng: -7.653410,
      status: 'en_cours' as const,
      progress: 34,
      budget: '18 800 000 MAD',
      spentProgress: 38,
      surface: '1 850 m²',
      workersCount: 22,
      complianceScore: '100%',
      scheduleAhead: 'Dans les temps',
      startDate: '10 Mar 2025',
      expectedEndDate: '15 Fév 2027',
      type: 'Villa Haut Standing',
      manager: { name: 'Youssef El Amrani', role: 'Conducteur de Travaux', phone: '+212 6 62 98 76 54', email: 'y.amrani@buildmaroc.ma', avatar: 'YA' },
      weather: 'Bouskoura • 25°C Ensoleillé',
      captures: [
        {
          id: 'cap-sem-01',
          week: 'Semaine 01',
          date: '12 Juil 2026',
          progress: 10,
          operator: 'Youssef El Amrani',
          note: 'Superstructure rez-de-chaussée',
          hotspots: [],
          zones: [
            { id: 'complet', name: 'Chantier complet', type: 'complet' },
            { id: 'etage1', name: '1er étage', type: 'etage1' },
            { id: 'balcon', name: 'Balcon & Façade', type: 'balcon' },
          ],
        },
        {
          id: 'cap-sem-20',
          week: 'Semaine 20',
          date: '19 Juil 2026',
          progress: 34,
          operator: 'Youssef El Amrani',
          note: 'Charpente métallique et baies vitrées',
          hotspots: [],
          zones: [
            { id: 'complet', name: 'Chantier complet', type: 'complet' },
            { id: 'etage1', name: '1er étage', type: 'etage1' },
            { id: 'balcon', name: 'Balcon & Façade', type: 'balcon' },
          ],
        },
      ],
      notes: [
        { id: 'note-201', text: 'Vérifier l\'avancement du gros œuvre et la livraison de la charpente.', author: 'Youssef El Amrani', date: '31 Juil 2026 - 09:00', priority: 'normal' as const },
      ],
    },
    {
      id: 'chk-003',
      code: 'RAB-2025-09',
      name: 'Immeuble Atlas Tower',
      location: 'Rabat',
      address: 'Avenue Annakhil, Hay Riad, Rabat',
      lat: 33.965410,
      lng: -6.879540,
      status: 'en_retard' as const,
      progress: 12,
      budget: '85 000 000 MAD',
      spentProgress: 18,
      surface: '28 500 m²',
      workersCount: 65,
      complianceScore: '92%',
      scheduleAhead: '-12 jours de retard',
      startDate: '01 Mai 2025',
      expectedEndDate: '30 Juin 2027',
      type: 'Bureaux (R+12)',
      manager: { name: 'Rachid Kabbaj', role: 'Directeur de Chantier', phone: '+212 6 63 11 22 33', email: 'r.kabbaj@buildmaroc.ma', avatar: 'RK' },
      weather: 'Rabat • 23°C Nuageux',
      captures: [
        {
          id: 'cap-sem-01',
          week: 'Semaine 01',
          date: '05 Juil 2026',
          progress: 12,
          operator: 'Rachid Kabbaj',
          note: 'Forage des pieux de fondation',
          hotspots: [],
          zones: [
            { id: 'complet', name: 'Chantier complet', type: 'complet' },
          ],
        },
      ],
      notes: [
        { id: 'note-301', text: 'Retard accumulé sur les pieux de fondation en raison d\'un sol rocheux.', author: 'Rachid Kabbaj', date: '31 Juil 2026 - 16:10', priority: 'high' as const },
      ],
    },
  ];

  const projectIds: Record<string, string> = {};
  const zoneIds: Record<string, Record<string, string>> = {};
  const capturePointIds: Record<string, Record<string, string>> = {};
  const panoramaIds: Record<string, Record<string, string>> = {};

  for (const chantier of chantierData) {
    const projectId = generateId();
    projectIds[chantier.id] = projectId;

    const startDate = parseFrenchDate(chantier.startDate);
    const expectedEndDate = parseFrenchDate(chantier.expectedEndDate);

    await db.insert(projects).values({
      id: projectId,
      organizationId: orgId,
      name: chantier.name,
      code: chantier.code,
      region: chantier.location,
      coordinates: { lng: chantier.lng, lat: chantier.lat },
      status: mapOperationalStatusToLifecycle(chantier.status),
      operationalStatus: chantier.status,
      managerUserId: userId,
      budgetCents: parseBudget(chantier.budget) ?? null,
      spentProgress: chantier.spentProgress,
      surfaceSqm: parseSurface(chantier.surface) ?? null,
      workersCount: chantier.workersCount,
      complianceScore: parseComplianceScore(chantier.complianceScore) ?? null,
      scheduleDeltaDays: parseScheduleDelta(chantier.scheduleAhead) ?? null,
      startDate: startDate ?? null,
      expectedEndDate: expectedEndDate ?? null,
    });
    console.log(`  ✅ Project created: ${chantier.name}`);

    // --- Zones ---
    zoneIds[chantier.id] = {};
    capturePointIds[chantier.id] = {};
    panoramaIds[chantier.id] = {};

    for (const capture of chantier.captures) {
      for (const zone of capture.zones) {
        const zoneId = generateId();
        zoneIds[chantier.id][zone.id] = zoneId;

        await db.insert(zones).values({
          id: zoneId,
          projectId,
          name: zone.name,
          level: zone.type,
        });

        // --- Capture Point ---
        const cpId = generateId();
        capturePointIds[chantier.id][`${capture.id}-${zone.id}`] = cpId;

        await db.insert(capturePoints).values({
          id: cpId,
          zoneId,
          title: `${capture.week} - ${zone.name}`,
        });

        // --- Panorama ---
        const panoramaId = generateId();
        panoramaIds[chantier.id][`${capture.id}-${zone.id}`] = panoramaId;

        await db.insert(panoramas).values({
          id: panoramaId,
          capturePointId: cpId,
          storagePath: `panoramas/${chantier.code}/${capture.id}/${zone.id}.jpg`,
          capturedAt: parseFrenchDate(capture.date) ?? new Date(),
          uploadedById: userId,
          metadata: {
            week: capture.week,
            progress: capture.progress,
            operator: capture.operator,
            note: capture.note,
          },
        });

        // --- Hotspots ---
        for (const hotspot of capture.hotspots) {
          await db.insert(hotspots).values({
            id: generateId(),
            panoramaId,
            pitch: hotspot.pitch,
            yaw: hotspot.yaw,
            title: hotspot.title,
            description: hotspot.text,
            status: 'pending',
          });
        }
      }
    }

    // --- Notes ---
    for (const note of chantier.notes) {
      await db.insert(notes).values({
        id: generateId(),
        projectId,
        createdById: userId,
        content: note.text,
      });
    }
  }
  console.log('  ✅ Zones, capture points, panoramas, hotspots, and notes created');

  // --- Trade Catalog (from PREDEFINED_TRADE_CATALOG) ---
  const tradeCatalogData = [
    { id: 'cat-chef', name: 'Chef de chantier', category: 'Encadrement', icon: 'chef', description: 'Direction opérationnelle et organisation quotidienne du chantier' },
    { id: 'cat-chef-equipe', name: "Chef d'équipe", category: 'Encadrement', icon: 'chef_equipe', description: 'Encadrement direct des équipes d\'exécution sur le terrain' },
    { id: 'cat-cond-travaux', name: 'Conducteur de travaux', category: 'Encadrement', icon: 'conducteur_travaux', description: 'Gestion administrative, technique et financière du chantier' },
    { id: 'cat-macon', name: 'Maçon', category: 'Gros Œuvre & Structure', icon: 'macon', description: 'Élévation de structures, bloc baies, parpaings, voiles béton et chapes' },
    { id: 'cat-coffreur', name: 'Coffreur / Boiseur', category: 'Gros Œuvre & Structure', icon: 'coffreur', description: 'Montage et assemblage des coffrages bois/métalliques pour béton armé' },
    { id: 'cat-ferrailleur', name: 'Ferrailleur', category: 'Gros Œuvre & Structure', icon: 'ferrailleur', description: 'Façonnage, ligaturage et pose des armatures métalliques' },
    { id: 'cat-manoeuvre', name: 'Manœuvre', category: 'Gros Œuvre & Structure', icon: 'manoeuvre', description: 'Aide générale, approvisionnement des postes et soutien aux ouvriers qualifiés' },
    { id: 'cat-conducteur-engins', name: 'Conducteur d\'engins', category: 'Levage & Matériel', icon: 'engins', description: 'Conduite des pelles, bulldozers, chargeuses et dumper' },
    { id: 'cat-grutier', name: 'Grutier', category: 'Levage & Matériel', icon: 'grutier', description: 'Pilotage de la grue à tour et gestion sécurisée des charges' },
    { id: 'cat-chauffeur', name: 'Chauffeur', category: 'Levage & Matériel', icon: 'chauffeur', description: 'Conduite de camion toupie, plateau et poids lourds de livraison' },
    { id: 'cat-elingueur', name: 'Élingueur / Rigging worker', category: 'Levage & Matériel', icon: 'elingueur', description: 'Accrochage des charges, contrôle des élingues et guidage' },
    { id: 'cat-signalman', name: 'Signalman / Banksman', category: 'Levage & Matériel', icon: 'signalman', description: 'Guidage visuel et radio des manœuvres d\'engins et de grue' },
    { id: 'cat-elec', name: 'Électricien', category: 'Fluides & Énergie', icon: 'elec', description: 'Tirage de câbles, armoires TGBT et raccordements électriques' },
    { id: 'cat-plombier', name: 'Plombier', category: 'Fluides & Énergie', icon: 'plombier', description: 'Installation des réseaux hydrauliques, évacuation et sanitaires' },
    { id: 'cat-soudeur', name: 'Soudeur', category: 'Fluides & Énergie', icon: 'soudeur', description: 'Soudure haute pression et assemblage tuyauterie/charpente' },
    { id: 'cat-etancheur', name: 'Étancheur', category: 'Enveloppe du Bâtiment', icon: 'etancheur', description: 'Pose de membranes bitumineuses et étanchéité de toitures/terrasses' },
    { id: 'cat-facadier', name: 'Façadier', category: 'Enveloppe du Bâtiment', icon: 'facadier', description: 'Pose de système ITE, enduits projetés et revêtement de façade' },
    { id: 'cat-peintre', name: 'Peintre', category: 'Second Œuvre & Finition', icon: 'peintre', description: 'Préparation des supports, impression et application de peintures' },
    { id: 'cat-carreleur', name: 'Carreleur', category: 'Second Œuvre & Finition', icon: 'carreleur', description: 'Pose de carrelage sol, faïence murale et réalisation de sous-couches' },
    { id: 'cat-plaquiste', name: 'Plaquiste', category: 'Second Œuvre & Finition', icon: 'plaquiste', description: 'Montage de cloisons BA13, faux-plafonds et isolation thermique' },
    { id: 'cat-menuisier-alu', name: 'Menuisier aluminium', category: 'Second Œuvre & Finition', icon: 'menuisier_alu', description: 'Pose des châssis alu, murs rideaux et verrières' },
    { id: 'cat-menuisier-bois', name: 'Menuisier bois', category: 'Second Œuvre & Finition', icon: 'menuisier_bois', description: 'Pose de bloc-portes bois, parquets et boiseries d\'intérieur' },
    { id: 'cat-serrurier', name: 'Serrurier', category: 'Second Œuvre & Finition', icon: 'serrurier', description: 'Pose de garde-corps, grilles, serrures et serrurerie métallique' },
    { id: 'cat-vitrier', name: 'Vitrier', category: 'Second Œuvre & Finition', icon: 'vitrier', description: 'Installation des vitrages simples/doubles et baies vitrées' },
    { id: 'cat-echafaudeur', name: 'Échafaudeur', category: 'Second Œuvre & Finition', icon: 'echafaudeur', description: 'Montage, ancrage et contrôle des échafaudages fixes et roulants' },
    { id: 'cat-geometre', name: 'Géomètre', category: 'Ingénierie & Contrôle', icon: 'geometre', description: 'Implantation topographique des axes, niveaux et bornages' },
    { id: 'cat-topographe', name: 'Topographe', category: 'Ingénierie & Contrôle', icon: 'topographe', description: 'Levé altimétrique, récolement et suivi d\'implantation' },
    { id: 'cat-laborantin', name: 'Laborantin', category: 'Ingénierie & Contrôle', icon: 'laborantin', description: 'Essais béton (écrasement d\'éprouvettes), contrôle compactage sols' },
    { id: 'cat-magasinier', name: 'Magasinier', category: 'Logistique & Support', icon: 'magasinier', description: 'Gestion du dépôt, réception des matériaux et suivi de stock' },
    { id: 'cat-logisticien', name: 'Logisticien', category: 'Logistique & Support', icon: 'logisticien', description: 'Planification des livraisons et flux de circulation du chantier' },
    { id: 'cat-mecanicien', name: 'Mécanicien d\'engins', category: 'Logistique & Support', icon: 'mecanicien', description: 'Entretien préventif et dépannage du parc d\'engins de chantier' },
    { id: 'cat-hse', name: 'Agent HSE / Safety Officer', category: 'Logistique & Support', icon: 'hse', description: 'Contrôle des consignes de sécurité, EPI et prévention des risques' },
    { id: 'cat-gardien', name: 'Gardien / Security Guard', category: 'Logistique & Support', icon: 'gardien', description: 'Surveillance nocturne, filtrage des accès et protection des biens' },
    { id: 'cat-nettoyage', name: 'Agent de nettoyage', category: 'Logistique & Support', icon: 'nettoyage', description: 'Nettoyage continu des zones de travail, repli et propreté du site' },
  ];

  for (const trade of tradeCatalogData) {
    await db.insert(tradeCatalog).values({
      id: generateId(),
      name: trade.name,
      category: trade.category,
      icon: trade.icon,
      description: trade.description,
    });
  }
  console.log(`  ✅ Trade catalog seeded (${tradeCatalogData.length} entries)`);

  // --- Subcontractors + Pointage Records ---
  const subcontractorData = [
    { id: 'sub-atlas', company: 'Atlas Construction', specialty: 'Gros œuvre & Maçonnerie', trades: [
      { id: 'subtrd-atlas-1', name: 'Maçons', category: 'Gros Œuvre', icon: 'macon', count: 10 },
      { id: 'subtrd-atlas-2', name: 'Coffreurs / Boiseurs', category: 'Structure', icon: 'coffreur', count: 4 },
    ]},
    { id: 'sub-beton', company: 'Béton Express', specialty: 'Coulage & Toupies', trades: [
      { id: 'subtrd-beton-1', name: 'Chauffeurs / Engins', category: 'Logistique', icon: 'chauffeur', count: 6 },
    ]},
    { id: 'sub-decobat', company: 'DecoBat', specialty: 'Peinture & Façade', trades: [
      { id: 'subtrd-decobat-1', name: 'Peintres / Applicateurs', category: 'Finition & Revêtement', icon: 'peintre', count: 4 },
    ]},
  ];

  const companyTradesData = [
    { id: 'trd-macon', name: 'Maçons', category: 'Gros Œuvre', icon: 'macon', count: 12 },
    { id: 'trd-coffreur', name: 'Coffreurs / Boiseurs', category: 'Structure', icon: 'coffreur', count: 8 },
    { id: 'trd-ferrailleur', name: 'Ferrailleurs', category: 'Structure', icon: 'ferrailleur', count: 6 },
    { id: 'trd-manoeuvre', name: 'Manœuvres', category: 'Gros Œuvre', icon: 'manoeuvre', count: 5 },
    { id: 'trd-chauffeur', name: 'Chauffeurs / Toupie', category: 'Logistique', icon: 'chauffeur', count: 3 },
    { id: 'trd-elec', name: 'Électriciens', category: 'Second Œuvre', icon: 'elec', count: 4 },
    { id: 'trd-plombier', name: 'Plombiers / Tuyauteurs', category: 'Second Œuvre', icon: 'plombier', count: 3 },
  ];

  // Seed subcontractors and pointage records for each project
  for (const chantier of chantierData) {
    const projectId = projectIds[chantier.id];
    if (!projectId) continue;

    // Company trades as pointage records
    for (const trade of companyTradesData) {
      await db.insert(pointageRecords).values({
        id: generateId(),
        projectId,
        date: new Date(),
        tradeId: null,
        count: trade.count,
        isCompanyTrade: 1,
        subcontractorId: null,
      });
    }

    // Subcontractors and their trades
    for (const sub of subcontractorData) {
      const subId = generateId();
      await db.insert(subcontractors).values({
        id: subId,
        projectId,
        company: sub.company,
        specialty: sub.specialty,
      });

      for (const trade of sub.trades) {
        await db.insert(pointageRecords).values({
          id: generateId(),
          projectId,
          date: new Date(),
          tradeId: null,
          count: trade.count,
          isCompanyTrade: 0,
          subcontractorId: subId,
        });
      }
    }
  }
  console.log('  ✅ Subcontractors and pointage records seeded');

  console.log('🌱 Database seed complete!');
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});