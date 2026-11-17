import { createContext, useContext, useMemo, useState } from 'react';

const TaskScheduleContext = createContext(null);

export function TaskScheduleProvider({ children }) {
  const [currentSchedule, setCurrentSchedule] = useState(null);
  const value = useMemo(() => ({ currentSchedule, setCurrentSchedule }), [currentSchedule]);

  return <TaskScheduleContext.Provider value={value}>{children}</TaskScheduleContext.Provider>;
}

export function useTaskSchedule() {
  const context = useContext(TaskScheduleContext);
  if (!context) throw new Error('useTaskSchedule must be used within TaskScheduleProvider.');
  return context;
}
