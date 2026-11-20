// Datos FICTICIOS con forma realista (Lima, Perú) para demos y tests sin API key.
// Incluye casos trampa a propósito: directorios, empresas solo en redes sociales,
// fuera de la ubicación o de otro sector, y datos de contacto solo en la página de contacto.

export interface MockPage {
  readonly url: string;
  readonly title: string;
  /** Extracto que devuelve la búsqueda. */
  readonly snippet: string;
  /** Texto completo que devuelve `fetch_page`; si falta, se usa el extracto. */
  readonly pageText?: string;
}

export interface MockSector {
  /** Fragmentos (sin tildes, en minúsculas) que identifican el sector en una consulta. */
  readonly keywords: readonly string[];
  readonly pages: readonly MockPage[];
}

const MARKETING: MockSector = {
  keywords: ['marketing', 'publicidad', 'branding', 'agencia digital', 'agencias digitales'],
  pages: [
    {
      url: 'https://pulsodigital-agencia.pe/',
      title: 'Pulso Digital | Agencia de marketing digital en Miraflores, Lima',
      snippet:
        'Pulso Digital es una agencia de marketing digital en Miraflores, Lima, con más de 8 años de experiencia. Equipo de 25 especialistas en SEO, pauta en Google y Meta Ads y desarrollo web para empresas B2B y retail. Clientes en banca, educación y consumo masivo.',
    },
    {
      url: 'https://pulsodigital-agencia.pe/contacto',
      title: 'Contacto | Pulso Digital',
      snippet: 'Escríbenos o visítanos en Miraflores, Lima.',
      pageText:
        'Contacto Pulso Digital\nAv. José Larco 1150, Of. 602, Miraflores, Lima\nTeléfono: (01) 446-2210\nEmail: hola@pulsodigital-agencia.pe\nHorario: lunes a viernes de 9:00 a 18:00',
    },
    {
      url: 'https://andinacreativa.pe/',
      title: 'Andina Creativa – Branding y publicidad | San Isidro',
      snippet:
        'Agencia de branding, diseño de identidad corporativa y campañas publicitarias en San Isidro, Lima. Más de 120 marcas peruanas atendidas desde 2015. Llámanos al +51 987 654 321. Calle Las Begonias 475, San Isidro.',
    },
    {
      url: 'https://nexogrowth.pe/',
      title: 'Nexo Growth Studio | Performance marketing para startups en Lima',
      snippet:
        'Estudio de growth y performance marketing en Barranco, Lima. Ayudamos a startups y fintechs a escalar adquisición con experimentos, analítica y automatización. Contacto: equipo@nexogrowth.pe',
    },
    {
      url: 'https://rankingagencias-peru.com/lima/marketing-digital',
      title: 'Las 15 mejores agencias de marketing digital en Lima (2026) – RankingAgencias',
      snippet:
        'Comparamos las mejores agencias de marketing digital de Lima según reseñas y precios: Pulso Digital, Andina Creativa, Nexo Growth Studio y más. Solicita cotizaciones gratis.',
    },
    {
      url: 'https://www.instagram.com/miradorsocial.pe/',
      title: 'Mirador Social (@miradorsocial.pe) • Instagram',
      snippet:
        'Community managers freelance en Surco, Lima. Gestión de redes sociales para emprendedores. Escríbenos por DM.',
    },
    {
      url: 'https://brujulamkt.pe/',
      title: 'Brújula Marketing | Agencia digital en Arequipa',
      snippet:
        'Agencia de marketing digital con sede en Arequipa, Perú. Campañas en redes sociales y SEO local para negocios del sur del país. Teléfono (054) 221-334.',
    },
    {
      url: 'https://academiamarketingpro.pe/cursos',
      title: 'Curso de Marketing Digital 100% online – Academia Marketing Pro',
      snippet:
        'Aprende marketing digital desde cero con certificación. Matrícula abierta en Lima y todo el Perú. 40% de descuento este mes.',
    },
  ],
};

const DENTAL: MockSector = {
  keywords: ['dental', 'dentales', 'odontolog', 'dentista', 'ortodoncia', 'implantes'],
  pages: [
    {
      url: 'https://sonrisaclara.pe/',
      title: 'Clínica Dental Sonrisa Clara | Ortodoncia invisible en Miraflores',
      snippet:
        'Clínica dental en Miraflores, Lima, especializada en ortodoncia invisible y estética dental. 12 especialistas y 2 sedes (Miraflores y San Borja). Citas: (01) 241-7788. Av. Benavides 1920, Miraflores. Email: citas@sonrisaclara.pe',
    },
    {
      url: 'https://odontolosolivos.pe/',
      title: 'Centro Odontológico Los Olivos – Odontología general y familiar',
      snippet:
        'Odontología general, limpiezas, endodoncia y odontopediatría en Los Olivos, Lima Norte. Atención de lunes a sábado. Teléfono: 975 112 340.',
    },
    {
      url: 'https://dentalia-implantes.pe/',
      title: 'Dentalia Implantes | Implantes dentales en San Borja, Lima',
      snippet:
        'Centro especializado en implantes dentales y rehabilitación oral en San Borja, Lima. Más de 5,000 implantes colocados desde 2012.',
      pageText:
        'Dentalia Implantes\nImplantología, rehabilitación oral y cirugía maxilofacial.\nSede principal: Av. San Luis 2450, San Borja, Lima\nCentral telefónica: (01) 715-3300\nSomos un equipo de 18 odontólogos especialistas.',
    },
    {
      url: 'https://guiamedicaperu.com/dentistas/lima',
      title: 'Dentistas en Lima: 230 clínicas dentales con opiniones – Guía Médica Perú',
      snippet:
        'Encuentra dentistas y clínicas dentales en Lima. Compara precios, lee opiniones y reserva cita online. Directorio actualizado 2026.',
    },
    {
      url: 'https://www.facebook.com/dentalkidssurco',
      title: 'Dental Kids Surco | Facebook',
      snippet:
        'Odontopediatría en Santiago de Surco, Lima. Escríbenos por WhatsApp para separar tu cita.',
    },
    {
      url: 'https://cuscodental.pe/',
      title: 'Cusco Dental – Clínica odontológica en Cusco',
      snippet:
        'Clínica odontológica en el centro histórico de Cusco. Ortodoncia, implantes y blanqueamiento. Teléfono (084) 255-901.',
    },
  ],
};

export const MOCK_SECTORS: readonly MockSector[] = [MARKETING, DENTAL];
