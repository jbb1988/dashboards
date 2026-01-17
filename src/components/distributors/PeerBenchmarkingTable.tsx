'use client';

interface PeerBenchmark {
  location_id: string;
  location_name: string;
  similarity_score: number;
  revenue_r12: number;
  transaction_count: number;
  category_count: number;
  avg_margin: number;
}

interface PeerBenchmarkingTableProps {
  currentLocation: {
    customer_id: string;
    customer_name: string;
    revenue: number;
    category_count: number;
    margin_pct: number;
  };
  peers: PeerBenchmark[];
  transactionCount?: number;
}

export default function PeerBenchmarkingTable({
  currentLocation,
  peers,
  transactionCount = 12,
}: PeerBenchmarkingTableProps) {
  return (
    <div className="p-6 rounded-xl bg-[#151F2E] border border-white/[0.06]">
      <h2 className="text-lg font-semibold text-white mb-4">Peer Benchmarking</h2>
      <p className="text-sm text-[#64748B] mb-6">
        Compare to similar locations within this distributor
      </p>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/10">
              <th className="text-left py-3 px-4 text-xs font-semibold text-[#64748B] uppercase tracking-wider">
                Location
              </th>
              <th className="text-right py-3 px-4 text-xs font-semibold text-[#64748B] uppercase tracking-wider">
                Similarity
              </th>
              <th className="text-right py-3 px-4 text-xs font-semibold text-[#64748B] uppercase tracking-wider">
                Revenue R12
              </th>
              <th className="text-right py-3 px-4 text-xs font-semibold text-[#64748B] uppercase tracking-wider">
                Transactions
              </th>
              <th className="text-right py-3 px-4 text-xs font-semibold text-[#64748B] uppercase tracking-wider">
                Categories
              </th>
              <th className="text-right py-3 px-4 text-xs font-semibold text-[#64748B] uppercase tracking-wider">
                Margin
              </th>
            </tr>
          </thead>
          <tbody>
            {/* Current Location (highlighted) */}
            <tr className="bg-cyan-500/10 border-b border-cyan-500/30">
              <td className="py-3 px-4 text-sm text-white font-medium">
                {currentLocation.customer_name} (You)
              </td>
              <td className="py-3 px-4 text-sm text-right text-cyan-400">-</td>
              <td className="py-3 px-4 text-sm text-right text-white">
                ${(currentLocation.revenue / 1000).toFixed(1)}k
              </td>
              <td className="py-3 px-4 text-sm text-right text-white">
                {transactionCount}
              </td>
              <td className="py-3 px-4 text-sm text-right text-white">
                {currentLocation.category_count}
              </td>
              <td className="py-3 px-4 text-sm text-right text-white">
                {currentLocation.margin_pct.toFixed(1)}%
              </td>
            </tr>

            {/* Peer Locations */}
            {peers.map((peer) => (
              <tr key={peer.location_id} className="border-b border-white/5 hover:bg-white/[0.02]">
                <td className="py-3 px-4 text-sm text-[#94A3B8]">
                  {peer.location_name}
                </td>
                <td className="py-3 px-4 text-sm text-right text-[#94A3B8]">
                  {peer.similarity_score}%
                </td>
                <td className="py-3 px-4 text-sm text-right text-[#94A3B8]">
                  ${(peer.revenue_r12 / 1000).toFixed(1)}k
                </td>
                <td className="py-3 px-4 text-sm text-right text-[#94A3B8]">
                  {peer.transaction_count}
                </td>
                <td className="py-3 px-4 text-sm text-right text-[#94A3B8]">
                  {peer.category_count}
                </td>
                <td className="py-3 px-4 text-sm text-right text-[#94A3B8]">
                  {peer.avg_margin.toFixed(1)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
