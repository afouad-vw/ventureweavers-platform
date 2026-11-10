/** Shown while a member page loads: a shimmer in the shape of a header and cards. */
export default function Loading() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="Loading">
      <div className="vw-shimmer h-[150px] rounded-[24px]" />
      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(260px,1fr))]">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="vw-shimmer h-[170px] rounded-[20px]" />
        ))}
      </div>
      <div className="vw-shimmer h-[220px] rounded-[20px]" />
    </div>
  );
}
