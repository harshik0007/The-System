import { createContext, useContext, useMemo, useState } from 'react';
import { dailyTasksDemo, dailyTaskScheduleDemo } from '../data/dailyTasksDemo.js';
import { getWeeklyChangePeriod } from '../utils/weeklyTaskChanges.js';

const TaskScheduleContext = createContext(null);

export function TaskScheduleProvider({ children }) {
  const [currentSchedule, setCurrentSchedule] = useState(() => ({
    cycleLength: dailyTaskScheduleDemo.cycleLength,
    startDate: dailyTaskScheduleDemo.cycleDayOneDate,
    source: 'demo',
    tasks: dailyTasksDemo.map((task) => ({
      ...task,
      cycleDays: [1, 2, 3, 4, 5, 6, 7],
      actionTitle: task.accountabilityAction,
      actionDescription: task.accountabilityActionDescription || '',
      weakness: '',
    })),
    taskHistory: [],
    occurrences: {},
  }));
  const [weeklyAllowance, setWeeklyAllowance] = useState(() => ({
    maximum: dailyTaskScheduleDemo.taskChangesAllowed,
    used: dailyTaskScheduleDemo.taskChangesUsed,
    weekStartDate: getWeeklyChangePeriod(dailyTaskScheduleDemo.taskChangesWeekDate).weekStartDate,
  }));
  const value = useMemo(() => ({ currentSchedule, setCurrentSchedule, weeklyAllowance, setWeeklyAllowance }), [currentSchedule, weeklyAllowance]);

  return <TaskScheduleContext.Provider value={value}>{children}</TaskScheduleContext.Provider>;
}

export function useTaskSchedule() {
  const context = useContext(TaskScheduleContext);
  if (!context) throw new Error('useTaskSchedule must be used within TaskScheduleProvider.');
  return context;
}
