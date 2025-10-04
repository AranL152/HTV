import FileUploader from '@/components/upload/FileUploader';

export default function UploadPage() {
  return (
    <div className="min-h-screen bg-gray-900 text-white py-12">
      <div className="max-w-6xl mx-auto px-4">
        <h1 className="text-4xl font-bold mb-2">Upload Your Dataset</h1>
        <p className="text-gray-400 mb-12">
          Upload a CSV file to analyze bias and visualize cluster distribution
        </p>
        <FileUploader />
      </div>
    </div>
  );
}
