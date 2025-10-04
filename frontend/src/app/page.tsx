import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 to-gray-900 text-white">
      <div className="max-w-6xl mx-auto px-4 py-20">
        <div className="text-center mb-16">
          <h1 className="text-6xl font-bold mb-6 bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent">
            Level
          </h1>
          <p className="text-2xl text-gray-300 mb-4">
            Visualize and correct bias in your datasets
          </p>
          <p className="text-lg text-gray-400 max-w-2xl mx-auto">
            Upload your dataset, see cluster distribution in 3D, and drag hills to rebalance
            overrepresented or underrepresented data points in real-time.
          </p>
        </div>

        <div className="flex justify-center mb-20">
          <Link
            href="/upload"
            className="bg-blue-600 hover:bg-blue-700 px-12 py-4 rounded-lg text-xl font-semibold transition-all hover:scale-105"
          >
            Get Started
          </Link>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
            <div className="text-4xl mb-4">📊</div>
            <h3 className="text-xl font-semibold mb-2">Upload & Analyze</h3>
            <p className="text-gray-400">
              Upload CSV datasets and automatically cluster them using multimodal embeddings
            </p>
          </div>

          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
            <div className="text-4xl mb-4">🏔️</div>
            <h3 className="text-xl font-semibold mb-2">Visualize Terrain</h3>
            <p className="text-gray-400">
              See your dataset as a 3D landscape where hills represent cluster sizes
            </p>
          </div>

          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
            <div className="text-4xl mb-4">⚖️</div>
            <h3 className="text-xl font-semibold mb-2">Rebalance Data</h3>
            <p className="text-gray-400">
              Drag hills up or down to adjust cluster weights and export balanced datasets
            </p>
          </div>
        </div>

        <div className="mt-20 text-center">
          <h2 className="text-3xl font-bold mb-6">How It Works</h2>
          <div className="max-w-3xl mx-auto space-y-4 text-left">
            <div className="flex items-start gap-4">
              <div className="bg-blue-600 text-white rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0 font-bold">
                1
              </div>
              <div>
                <h4 className="font-semibold mb-1">Upload Your Dataset</h4>
                <p className="text-gray-400">
                  Drop a CSV file containing your data. Select which column to analyze.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="bg-blue-600 text-white rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0 font-bold">
                2
              </div>
              <div>
                <h4 className="font-semibold mb-1">Automatic Clustering</h4>
                <p className="text-gray-400">
                  AI generates embeddings and clusters your data, then creates human-readable descriptions.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="bg-blue-600 text-white rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0 font-bold">
                3
              </div>
              <div>
                <h4 className="font-semibold mb-1">Interactive Visualization</h4>
                <p className="text-gray-400">
                  View your dataset as a 3D terrain. Overrepresented clusters form mountains,
                  underrepresented clusters appear as valleys.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="bg-blue-600 text-white rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0 font-bold">
                4
              </div>
              <div>
                <h4 className="font-semibold mb-1">Drag to Rebalance</h4>
                <p className="text-gray-400">
                  Click and drag hills to adjust their heights. Watch metrics improve in real-time.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="bg-blue-600 text-white rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0 font-bold">
                5
              </div>
              <div>
                <h4 className="font-semibold mb-1">Export Balanced Data</h4>
                <p className="text-gray-400">
                  Download your rebalanced dataset with adjusted weights for ML training.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
