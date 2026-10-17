// Ré-export direct de Recharts.
// Les composants enfants (Bar, XAxis, YAxis, Tooltip…) doivent rester les vrais
// composants Recharts : Recharts 2.x les repère par leur type dans les enfants du
// graphique. Les envelopper dans React.lazy les rendait invisibles et laissait
// tous les graphiques vides.
export {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Funnel,
  FunnelChart,
  LabelList,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  Treemap,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";

export type { LegendProps } from "recharts";
