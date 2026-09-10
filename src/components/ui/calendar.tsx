import { useState } from "react";
import { cn } from "../../lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";

type SingleProps = {
  className?: string;
  mode?: "single";
  selected?: Date;
  onSelect?: (date?: Date) => void;
  numberOfMonths?: number;
};

type RangeProps = {
  className?: string;
  mode: "range";
  selected?: { from?: Date; to?: Date };
  onSelect?: (range?: { from?: Date; to?: Date }) => void;
  numberOfMonths?: number;
};

export type CalendarProps = SingleProps | RangeProps;

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

export function Calendar({ className, mode = "single", selected, onSelect }: CalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  
  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };
  
  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };
  
  const isSameDay = (date1: Date, date2: Date) => {
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate();
  };
  
  const isInRange = (date: Date, range: { from?: Date; to?: Date }) => {
    if (!range.from || !range.to) return false;
    return date >= range.from && date <= range.to;
  };
  
  const isToday = (date: Date) => {
    return isSameDay(date, new Date());
  };
  
  const handleDateClick = (date: Date) => {
  if (mode === "single") {
    // Narrow onSelect to the single signature
    const onSelectSingle = onSelect as ((d?: Date) => void) | undefined;
    onSelectSingle?.(date);
    return;
  }

  // mode === "range"
  const onSelectRange = onSelect as ((r?: { from?: Date; to?: Date }) => void) | undefined;
  const currentRange = (selected as { from?: Date; to?: Date } | undefined) ?? {};

  // If no 'from' yet, or already had a complete range -> start new with 'from'
  if (!currentRange.from || currentRange.to) {
    onSelectRange?.({ from: date, to: undefined });
  } else {
    // We have a 'from' but no 'to' yet
    if (date < currentRange.from) {
      onSelectRange?.({ from: date, to: currentRange.from });
    } else {
      onSelectRange?.({ from: currentRange.from, to: date });
    }
  }
};
  
  const renderMonth = (monthDate: Date) => {
    const daysInMonth = getDaysInMonth(monthDate);
    const firstDay = getFirstDayOfMonth(monthDate);
    const days = [];
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="h-10 w-10"></div>);
    }
    
    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(monthDate.getFullYear(), monthDate.getMonth(), day);
      const isSelectedSingle = mode === "single" && selected instanceof Date && isSameDay(date, selected);
      
      let isSelectedRange = false;
      if (mode === "range" && selected && typeof selected === "object" && !(selected instanceof Date)) {
        const range = selected as { from?: Date; to?: Date };
        isSelectedRange = 
          (range.from && isSameDay(date, range.from)) || 
          (range.to && isSameDay(date, range.to)) ||
          isInRange(date, range);
      }
      
      const isTodayDate = isToday(date);
      
      days.push(
        <button
          key={day}
          onClick={() => handleDateClick(date)}
          className={cn(
            "h-10 w-10 flex items-center justify-center rounded text-sm transition-colors cursor-pointer",
            "text-white hover:bg-gray-700",
            {
              "bg-blue-600 text-white hover:bg-blue-700": isSelectedSingle || isSelectedRange,
              "bg-gray-700 font-semibold border border-blue-500": isTodayDate && !isSelectedSingle && !isSelectedRange,
            }
          )}
        >
          {day}
        </button>
      );
    }
    
    return days;
  };
  
  const navigateMonth = (direction: "prev" | "next") => {
    setCurrentMonth(prev => {
      const newMonth = new Date(prev);
      if (direction === "prev") {
        newMonth.setMonth(prev.getMonth() - 1);
      } else {
        newMonth.setMonth(prev.getMonth() + 1);
      }
      return newMonth;
    });
  };
  
  return (
    <div className={cn("p-3 text-white", className)}>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex justify-center items-center relative">
          <button
            onClick={() => navigateMonth("prev")}
            className="absolute left-1 h-7 w-7 bg-transparent border-0 p-0 opacity-50 hover:opacity-100 text-white flex items-center justify-center"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="text-sm font-medium text-white">
            {MONTHS[currentMonth.getMonth()]} {currentMonth.getFullYear()}
          </div>
          <button
            onClick={() => navigateMonth("next")}
            className="absolute right-1 h-7 w-7 bg-transparent border-0 p-0 opacity-50 hover:opacity-100 text-white flex items-center justify-center"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        
        {/* Calendar Grid */}
        <div className="w-full">
          {/* Days of week header */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {DAYS.map(day => (
              <div key={day} className="h-8 flex items-center justify-center text-gray-400 text-xs uppercase font-normal">
                {day}
              </div>
            ))}
          </div>
          
          {/* Calendar days */}
          <div className="grid grid-cols-7 gap-1">
            {renderMonth(currentMonth)}
          </div>
        </div>
      </div>
    </div>
  );
}