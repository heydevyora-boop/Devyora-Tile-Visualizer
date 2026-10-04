import type { DesignOption } from '../utils/api'

/** One selectable option from a showroom list: its image if it has one, its name and its description. */
function OptionCard({
  option,
  selected,
  onSelect,
}: {
  option: DesignOption
  selected: boolean
  onSelect: (option: DesignOption) => void
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={`w-full text-left rounded-xl overflow-hidden shadow-sm flex items-stretch transition-all ${
        selected
          ? 'bg-surface-container ring-1 ring-primary'
          : 'bg-surface-container-low hover:bg-surface-container'
      }`}
      onClick={() => onSelect(option)}
    >
      {option.imageUrl && (
        <img
          className="w-24 h-24 object-cover flex-shrink-0"
          src={option.imageUrl}
          alt={option.name}
          loading="lazy"
        />
      )}
      <span className="flex-1 min-w-0 p-space-md flex flex-col justify-center gap-1">
        <span className="font-title-md text-title-md text-on-surface">{option.name}</span>
        {option.description && (
          <span className="font-body-sm text-body-sm text-on-surface-variant">{option.description}</span>
        )}
      </span>
    </button>
  )
}

export default OptionCard
