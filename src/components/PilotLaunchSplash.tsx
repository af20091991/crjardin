import { LAUNCH_PHASES as P } from "@/lib/launch-splash";

/* Palette exacte du logo « De la graine au jardin ». */
const C = {
  green: "#4AAC33",
  brown: "#825A41",
  orange: "#EE8627",
  yellow: "#EDE022",
  blue: "#2E8CCC",
  dark: "#702D12",
  name: "#4F8E33",
  bg: "#F9F7F2",
};

const s = (v: number) => `${v.toFixed(2)}s`;
const leafAt = (i: number) => s(P.leaf.start + i * P.leaf.stagger);

/** Styles de l'animation, générés depuis les phases réglables. */
export const LAUNCH_SPLASH_CSS = `
html.js-client #pp-splash{display:none!important}
#pp-splash{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;background:${C.bg};transition:opacity .6s ease,visibility .6s;cursor:pointer;-webkit-tap-highlight-color:transparent}
#pp-splash.pp-out{opacity:0;visibility:hidden;pointer-events:none}
#pp-splash svg{width:min(84vmin,460px);height:auto;overflow:visible}
#pp-splash .pp-skip{position:absolute;bottom:calc(env(safe-area-inset-bottom) + 18px);font:500 13px 'EB Garamond',Garamond,serif;color:#444444;opacity:0;letter-spacing:.08em;animation:pp-in .5s ease 1.5s forwards}
#pp-splash .pp-seed{transform-origin:300px 712px;transform:scale(0);animation:pp-pop ${s(P.seed.dur)} cubic-bezier(.3,1.4,.5,1) ${s(P.seed.start)} forwards}
#pp-splash .pp-stem{stroke-dasharray:1;stroke-dashoffset:1;animation:pp-draw ${s(P.stem.dur)} ease-out ${s(P.stem.start)} forwards}
#pp-splash .pp-leaf{opacity:0;transform-origin:300px 712px;transform:scale(.15) rotate(-14deg);animation:pp-grow ${s(P.leaf.dur)} cubic-bezier(.25,.9,.3,1.1) forwards}
#pp-splash .pp-ring{stroke-dasharray:1;stroke-dashoffset:1;animation:pp-draw ${s(P.ring.dur)} cubic-bezier(.55,.1,.35,1) ${s(P.ring.start)} forwards}
#pp-splash .pp-name{opacity:0;transform:translateY(14px);animation:pp-rise ${s(P.name.dur)} ease ${s(P.name.start)} forwards}
#pp-splash .pp-motto{opacity:0;animation:pp-in ${s(P.motto.dur)} ease ${s(P.motto.start)} forwards}
#pp-splash .pp-art{transform-origin:443px 450px;animation:pp-beat 1.55s ease-in-out ${s(P.heart.start)} 1}
@keyframes pp-draw{to{stroke-dashoffset:0}}
@keyframes pp-pop{to{transform:scale(1)}}
@keyframes pp-grow{to{opacity:1;transform:none}}
@keyframes pp-rise{to{opacity:1;transform:none}}
@keyframes pp-in{to{opacity:1}}
@keyframes pp-beat{0%,40%,100%{transform:scale(1)}6%,48%{transform:scale(1.03)}12%,54%{transform:scale(1)}18%,60%{transform:scale(1.02)}26%,68%{transform:scale(1)}}
@media (prefers-reduced-motion:reduce){#pp-splash *{animation:none!important;opacity:1!important;transform:none!important;stroke-dashoffset:0!important}}
`;

/** Écran de lancement PilotPro : graine → tige → feuille → cercle ouvert → nom. */
export function PilotLaunchSplash() {
  // Un seul cercle parfait (centre 443,450 ; rayon 400), ouvert à gauche : du bas-gauche,
  // par le bas, la droite et le haut, jusqu'au haut-gauche. Jamais fermé.
  const ring = "M 67.1 586.8 A 400 400 0 1 0 213.6 122.3";
  return (
    <div id="pp-splash" aria-hidden="true">
      <svg viewBox="0 0 886 886">
        <defs>
          <path id="pp-motto-path" d="M 476.1 828.6 A 380 380 0 0 0 810.1 548.4" />
          <mask id="pp-ring-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="886" height="886">
            <path
              className="pp-ring"
              pathLength={1}
              d="M 67.1 586.8 A 400 400 0 1 0 213.6 122.3"
              fill="none"
              stroke="#FFFFFF"
              strokeWidth="10"
            />
          </mask>
        </defs>
        <g className="pp-art">
          {/* Trait brun : même tracé, révélé par un masque ; des segments plus épais superposés
              sur exactement la même ligne donnent une épaisseur légèrement vivante. */}
          <g mask="url(#pp-ring-mask)">
            <path d={ring} fill="none" stroke={C.brown} strokeWidth="1.7" strokeLinecap="round" />
            <path
              d={ring}
              pathLength={1}
              fill="none"
              stroke={C.brown}
              strokeWidth="2.6"
              strokeOpacity=".55"
              strokeLinecap="round"
              strokeDasharray="0.09 0.05 0.14 0.07 0.06 0.04 0.12 0.06 0.1 0.05 0.08 0.14"
            />
          </g>
          {/* Tige / pétiole qui pousse depuis la graine */}
          <path
            className="pp-stem"
            pathLength={1}
            d="M 300 712 C 210 706 128 650 112 528"
            fill="none"
            stroke={C.brown}
            strokeWidth="9"
            strokeLinecap="round"
          />
          <ellipse className="pp-seed" cx="300" cy="712" rx="22" ry="14" fill={C.dark} />
          {/* Parties colorées de la feuille */}
          <path
            className="pp-leaf"
            style={{ animationDelay: leafAt(0) }}
            fill={C.brown}
            d="M 278 708 L 512 640 L 584 742 C 480 778 340 770 278 708 Z"
          />
          <path
            className="pp-leaf"
            style={{ animationDelay: leafAt(1) }}
            fill={C.orange}
            d="M 270 703 C 292 590 362 470 466 440 L 552 540 C 520 602 402 680 270 703 Z"
          />
          <path
            className="pp-leaf"
            style={{ animationDelay: leafAt(2) }}
            fill={C.yellow}
            d="M 482 425 C 560 362 612 292 626 186 C 640 290 628 400 572 520 Z"
          />
          <path
            className="pp-leaf"
            style={{ animationDelay: leafAt(3) }}
            fill={C.green}
            d="M 632 186 C 760 262 790 420 762 560 C 738 652 682 712 602 728 L 512 630 C 602 540 644 400 632 186 Z"
          />
          <path
            className="pp-leaf"
            style={{ animationDelay: leafAt(4) }}
            fill="none"
            stroke={C.blue}
            strokeWidth="11"
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M 628 186 C 642 380 582 520 510 626 L 584 742 M 274 710 C 380 690 470 652 510 626"
          />
          {/* Nom dans l'ouverture du cercle */}
          <text
            className="pp-name"
            x="84"
            y="298"
            fill={C.name}
            fontFamily="'EB Garamond',Garamond,serif"
            fontSize="96"
            fontWeight="600"
          >
            PilotPro
          </text>
          <text
            className="pp-motto"
            fill={C.name}
            fontFamily="'EB Garamond',Garamond,serif"
            fontSize="44"
            fontStyle="italic"
          >
            <textPath href="#pp-motto-path" startOffset="2%">
              au rythme de la nature
            </textPath>
          </text>
        </g>
      </svg>
      <span className="pp-skip">Toucher pour passer</span>
    </div>
  );
}
