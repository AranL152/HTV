import FileUploader from '@/components/FileUploader';

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8">
      <main className="flex flex-col items-center gap-8 max-w-2xl w-full">
        <div className="text-center space-y-4">
          <h1 className="text-5xl font-bold tracking-tight">Level</h1>
          <p className="text-xl text-white/60">
            Visualize and rebalance your datasets
          </p>
          <p className="text-sm text-white/40 max-w-md mx-auto">
            Upload a CSV dataset to analyze cluster distribution and adjust bias
            with an interactive waveform visualization
          </p>
        </div>

        <FileUploader />

        <div className="text-xs text-white/30 text-center max-w-md">
          Your dataset is embedded using Snowflake Arctic, clustered with DBSCAN,
          and analyzed by Gemini AI to generate human-readable descriptions
        </div>
      </main>
    </div>
  );
}
