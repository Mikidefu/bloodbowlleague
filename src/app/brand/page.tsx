import type { Metadata } from 'next';
import { Trophy } from 'lucide-react';
import Emblem from '@/components/brand/Emblem';
import PageHeader from '@/components/brand/PageHeader';
import styles from './Brand.module.css';

export const metadata: Metadata = {
  title: 'Brand Kit · Blood Bowl League',
};

const SWATCHES = [
  { name: 'Blood', token: '--bb-blood-700', hex: '#9a2226' },
  { name: 'Rulebook Red', token: '--bb-red', hex: '#c8252c' },
  { name: 'Slate', token: '--bb-slate-800', hex: '#2d323a' },
  { name: 'Mustard', token: '--bb-mustard', hex: '#eab22a' },
  { name: 'Tan', token: '--bb-tan', hex: '#b8926a' },
  { name: 'Parchment', token: '--bb-parchment', hex: '#efe5d2' },
  { name: 'Navy', token: '--bb-navy', hex: '#25386f' },
  { name: 'Sky', token: '--bb-sky', hex: '#e3e8f2' },
];

const ASSETS = [
  { file: 'badge-ring.svg', label: 'Badge ring' },
  { file: 'stars-bar.svg', label: 'Stars bar' },
  { file: 'splatter-a.svg', label: 'Splatter A' },
  { file: 'splatter-b.svg', label: 'Splatter B' },
  { file: 'spiked-ball.svg', label: 'Spiked ball' },
  { file: 'chain.svg', label: 'Chain link' },
  { file: 'grain.svg', label: 'Grain texture' },
  { file: 'grunge.svg', label: 'Grunge texture' },
];

const ROSTER = [
  { qty: '0-16', pos: 'Lineman', cost: '50,000', ma: 6, st: 3, ag: '3+', pa: '4+', av: '9+', skills: 'None' },
  { qty: '0-2', pos: 'Blitzer', cost: '85,000', ma: 7, st: 3, ag: '3+', pa: '4+', av: '9+', skills: 'Block' },
  { qty: '0-2', pos: 'Catcher', cost: '75,000', ma: 8, st: 2, ag: '3+', pa: '5+', av: '8+', skills: 'Catch, Dodge' },
  { qty: '0-1', pos: 'Big Guy', cost: '140,000', ma: 5, st: 5, ag: '4+', pa: '5+', av: '10+', skills: 'Loner (4+), Mighty Blow, Thick Skull' },
];

// Vetrina del design system "New Season": colori, tipografia, componenti e asset
export default function BrandPage() {
  return (
    <div className={styles.page}>
      <PageHeader
        kicker="Brand Kit"
        title="New Season!"
        icon={<Trophy size={48} />}
        subtitle="Asset, token e componenti del restyling ispirato a Spike! Journal e al Rulebook della terza stagione."
      />

      <section className={styles.section}>
        <h2 className="title-spike">Emblem</h2>
        <div className={styles.emblemRow}>
          <Emblem size={220} />
          <Emblem size={140} topText="SEASON" bottomText="2026" initials={['N', 'S']} />
          <Emblem size={80} />
        </div>
      </section>

      <section className={styles.section}>
        <h2 className="title-spike">Palette</h2>
        <div className={styles.swatches}>
          {SWATCHES.map(swatch => (
            <div key={swatch.token} className={styles.swatch}>
              <span className={styles.chip} style={{ background: `var(${swatch.token})` }} />
              <strong>{swatch.name}</strong>
              <code>{swatch.token}</code>
              <code>{swatch.hex}</code>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.twoCol}>
        <div className="card">
          <h2 className="title-slab">Typography!</h2>
          <p className={styles.sampleDisplay}>Barlow Condensed · Display</p>
          <p className={styles.sampleSlab}>Rokkitt · Slab</p>
          <h3 className="subhead">Small caps subhead</h3>
          <p className="dropcap">
            Body copy in Archivo. Coaches will see their teams adapt and evolve over the course of a league season,
            buying new players and watching rookies blossom into stars — if they survive the casualty table.
          </p>
        </div>

        <div className="panel-blood">
          <h2 className="title-spike">Greetings sports fans!</h2>
          <p className={`intro-box dropcap ${styles.intro}`}>
            Welcome back to the league&apos;s premiere sports periodical. Keep your helmet on and your apothecary close.
          </p>
          <div className={styles.buttons}>
            <button className="btn btn-gold">Gold</button>
            <button className="btn btn-primary">Primary</button>
            <button className="btn btn-navy">Navy</button>
            <button className="btn btn-slate">Slate</button>
            <button className="btn">Parchment</button>
          </div>
          <div className={styles.tags}>
            <span className="tag">Team spotlight</span>
            <span className="tag tag-red">Dead</span>
            <span className="tag tag-navy">Played</span>
            <span className="page-tab">13</span>
          </div>
          <span className={`splatter ${styles.splatter}`} aria-hidden="true" />
        </div>
      </section>

      <section className={styles.section}>
        <h2 className="title-spike">Roster table</h2>
        <div className="table-container">
          <div className="stars-bar" />
          <table className="data-table">
            <thead>
              <tr>
                <th>Qty</th><th>Position</th><th className="num">Cost</th>
                <th className="num">MA</th><th className="num">ST</th><th className="num">AG</th>
                <th className="num">PA</th><th className="num">AV</th><th>Skills &amp; Traits</th>
              </tr>
            </thead>
            <tbody>
              {ROSTER.map(row => (
                <tr key={row.pos}>
                  <td>{row.qty}</td><td>{row.pos}</td><td className="num">{row.cost}</td>
                  <td className="num">{row.ma}</td><td className="num">{row.st}</td><td className="num">{row.ag}</td>
                  <td className="num">{row.pa}</td><td className="num">{row.av}</td><td>{row.skills}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={6}>0-8 team re-rolls: 50,000 gold pieces each</td>
                <td colSpan={3}>Apothecary: yes</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      <section className={styles.section}>
        <h2 className="title-spike">SVG assets</h2>
        <div className={styles.assets}>
          {ASSETS.map(asset => (
            <figure key={asset.file} className={styles.asset}>
              <div className={styles.assetPreview}>
                <img src={`/brand/${asset.file}`} alt={asset.label} />
              </div>
              <figcaption>
                <strong>{asset.label}</strong>
                <code>/brand/{asset.file}</code>
              </figcaption>
            </figure>
          ))}
        </div>
        <div className={`chain-rule ${styles.chain}`} />
      </section>
    </div>
  );
}
