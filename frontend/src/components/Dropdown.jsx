import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, Search, X } from 'lucide-react';

/**
 * Reusable Custom Dropdown Component
 *
 * @param {Object} props
 * @param {string} [props.id] - Element ID
 * @param {string} [props.name] - Form field name
 * @param {string} [props.label] - Input label text
 * @param {Array<Object|string|number>} props.options - Array of option objects {value, label, sublabel, icon, avatar} or primitives
 * @param {string|number} props.value - Selected value
 * @param {Function} props.onChange - Callback function receiving (value, option) or event object {target: {name, value, id}}
 * @param {string} [props.placeholder='Select an option...'] - Placeholder text
 * @param {React.ReactNode} [props.icon] - Left icon inside trigger
 * @param {string} [props.error] - Error message
 * @param {boolean} [props.disabled=false] - Disabled state
 * @param {boolean} [props.required=false] - Required field indicator
 * @param {'sm'|'md'|'lg'} [props.size='md'] - Component size
 * @param {boolean} [props.searchable] - Force enable or disable search box (auto-enabled if >5 options)
 * @param {string} [props.className=''] - Extra wrapper CSS classes
 */
export default function Dropdown({
  id,
  name,
  label,
  options = [],
  value,
  onChange,
  placeholder = 'Select an option...',
  icon,
  error,
  disabled = false,
  required = false,
  size = 'md',
  searchable,
  className = ''
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef(null);
  const searchInputRef = useRef(null);

  // Normalize options into standardized format [{ value, label, sublabel, icon, avatar, disabled }]
  const normalizedOptions = options.map((opt) => {
    if (typeof opt === 'object' && opt !== null) {
      return {
        value: opt.value !== undefined ? opt.value : opt.id,
        label: opt.label !== undefined ? opt.label : (opt.name || String(opt.value || opt.id || '')),
        sublabel: opt.sublabel || opt.email || '',
        icon: opt.icon || null,
        avatar: opt.avatar || (opt.name ? opt.name.substring(0, 2).toUpperCase() : null),
        disabled: Boolean(opt.disabled)
      };
    }
    return {
      value: opt,
      label: String(opt),
      sublabel: '',
      icon: null,
      avatar: null,
      disabled: false
    };
  });

  // Find currently selected option object
  const selectedOption = normalizedOptions.find(
    (opt) => String(opt.value) === String(value)
  );

  // Determine if search input should be visible
  const isSearchable = searchable !== undefined ? searchable : normalizedOptions.length > 5;

  // Filter options based on search query
  const filteredOptions = normalizedOptions.filter((opt) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      opt.label.toLowerCase().includes(term) ||
      opt.sublabel.toLowerCase().includes(term) ||
      String(opt.value).toLowerCase().includes(term)
    );
  });

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  // Auto-focus search input when menu opens
  useEffect(() => {
    if (isOpen && isSearchable && searchInputRef.current) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    } else if (!isOpen) {
      setSearchTerm('');
    }
  }, [isOpen, isSearchable]);

  // Handle keyboard events (Escape to close)
  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  const handleSelectOption = (option) => {
    if (option.disabled) return;

    if (onChange) {
      // Pass synthetic-compatible event object as well as option value
      const syntheticEvent = {
        target: {
          id: id || name,
          name: name || id,
          value: option.value
        }
      };
      onChange(syntheticEvent, option);
    }
    setIsOpen(false);
  };

  // Size styling maps
  const sizeClasses = {
    sm: 'px-3 py-1.5 text-xs rounded-lg min-h-[34px]',
    md: 'px-4 py-2.5 text-sm rounded-xl min-h-[42px]',
    lg: 'px-5 py-3 text-base rounded-2xl min-h-[48px]'
  };

  const iconSizes = {
    sm: 'w-3.5 h-3.5',
    md: 'w-4 h-4',
    lg: 'w-5 h-5'
  };

  return (
    <div className={`relative w-full text-left font-sans ${className}`} ref={dropdownRef} onKeyDown={handleKeyDown}>
      {/* Optional Label */}
      {label && (
        <label htmlFor={id} className="block text-slate-300 text-xs font-semibold mb-1.5 uppercase tracking-wider">
          {label}
          {required && <span className="text-rose-400 ml-1">*</span>}
        </label>
      )}

      {/* Trigger Button */}
      <button
        type="button"
        id={id}
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={`w-full flex items-center justify-between gap-2 border transition-all duration-200 cursor-pointer ${
          sizeClasses[size] || sizeClasses.md
        } ${
          isOpen
            ? 'border-indigo-500 ring-2 ring-indigo-500/25 bg-slate-900/90'
            : 'border-slate-700/50 hover:border-slate-600 bg-slate-900/60'
        } ${
          error ? 'border-rose-500/70 focus:ring-rose-500/25' : ''
        } ${
          disabled ? 'opacity-50 cursor-not-allowed bg-slate-950/40' : 'backdrop-blur-md'
        } text-white shadow-sm`}
      >
        <div className="flex items-center gap-2.5 min-w-0 overflow-hidden text-left">
          {/* Custom Left Icon or Avatar */}
          {selectedOption?.avatar ? (
            <span className="w-5 h-5 rounded-full bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0 shadow-sm">
              {selectedOption.avatar}
            </span>
          ) : icon ? (
            <span className={`text-indigo-400 flex-shrink-0 ${iconSizes[size]}`}>{icon}</span>
          ) : null}

          {/* Selected Text / Placeholder */}
          <span className="truncate">
            {selectedOption ? (
              <span className="font-medium text-slate-100">{selectedOption.label}</span>
            ) : (
              <span className="text-slate-400">{placeholder}</span>
            )}
          </span>
        </div>

        {/* Right Chevron Arrow */}
        <ChevronDown
          className={`${iconSizes[size]} text-slate-400 flex-shrink-0 transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-indigo-400' : ''
          }`}
        />
      </button>

      {/* Dropdown Options Popup */}
      {isOpen && (
        <div className="absolute left-0 right-0 mt-2 z-50 rounded-2xl bg-slate-900/95 border border-slate-700/60 shadow-2xl backdrop-blur-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
          {/* Search Bar Input (if searchable) */}
          {isSearchable && (
            <div className="p-2.5 border-b border-slate-800/80 bg-slate-950/40 relative flex items-center">
              <Search className="w-4 h-4 text-slate-400 absolute left-5 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search..."
                className="w-full pl-9 pr-8 py-1.5 text-xs bg-slate-900 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-4 text-slate-400 hover:text-slate-200 p-1 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}

          {/* Options List */}
          <div className="max-h-60 overflow-y-auto p-1.5 space-y-0.5 custom-scrollbar" role="listbox">
            {filteredOptions.length === 0 ? (
              <div className="py-4 px-3 text-center text-xs text-slate-500">
                No matching options found
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = String(opt.value) === String(value);

                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    disabled={opt.disabled}
                    onClick={() => handleSelectOption(opt)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs sm:text-sm text-left transition-all duration-150 cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-600/20 text-indigo-200 border-l-2 border-indigo-500 font-semibold'
                        : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
                    } ${opt.disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {opt.avatar ? (
                        <span
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0 shadow-sm ${
                            isSelected
                              ? 'bg-gradient-to-tr from-indigo-500 to-purple-500'
                              : 'bg-slate-700/80 text-slate-300'
                          }`}
                        >
                          {opt.avatar}
                        </span>
                      ) : opt.icon ? (
                        <span className="text-indigo-400 flex-shrink-0">{opt.icon}</span>
                      ) : null}

                      <div className="min-w-0">
                        <div className="truncate font-medium">{opt.label}</div>
                        {opt.sublabel && (
                          <div className="text-[11px] text-slate-400 truncate mt-0.5 font-normal">
                            {opt.sublabel}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Active Checkmark */}
                    {isSelected && (
                      <Check className="w-4 h-4 text-indigo-400 flex-shrink-0 ml-2" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && <p className="mt-1 text-xs text-rose-400">{error}</p>}
    </div>
  );
}
