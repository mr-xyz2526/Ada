import { riskBadge } from '../utils/riskColors';

export default function RiskBadge({ level }) {
  return <span className={`px-2 py-1 rounded-full text-xs font-semibold ${riskBadge[level]}`}>{level}</span>;
}
