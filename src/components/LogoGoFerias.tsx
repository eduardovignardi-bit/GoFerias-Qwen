export default function LogoGoFerias({ subtitulo }: { subtitulo?: string }) {
  return (
    <div className="flex items-center gap-2.5 select-none">
      <div className="flex items-center font-extrabold text-2xl sm:text-3xl tracking-tight">
        <span className="text-[#155E75] relative inline-flex items-center">
          Go
          <svg
            viewBox="0 0 24 24"
            fill="currentColor"
            className="w-4 h-4 text-[#155E75] -mt-4 -ml-0.5 transform -rotate-12"
          >
            <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" />
          </svg>
        </span>
        <span className="text-[#E87722]">Férias</span>
      </div>
      {subtitulo && (
        <span className="text-xs font-semibold text-gray-500 border-l border-gray-300 pl-2.5">
          {subtitulo}
        </span>
      )}
    </div>
  );
}
