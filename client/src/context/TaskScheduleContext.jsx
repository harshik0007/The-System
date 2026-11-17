import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { dailyTasksDemo, dailyTaskScheduleDemo } from '../data/dailyTasksDemo.js';
import { getWeeklyChangePeriod } from '../utils/weeklyTaskChanges.js';
import { completeRecoveryQuest, createRecoveryQuestState, expireRecoveryQuest, generateRecoveryQuest } from '../utils/recoveryQuestManager.js';
import { getIstDateKey } from '../utils/taskScheduleBuilder.js';

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
  const [recoveryState, setRecoveryState] = useState(() => createRecoveryQuestState(dailyTasksDemo, getIstDateKey()));
  const recoveryStateRef = useRef(recoveryState);
  recoveryStateRef.current = recoveryState;

  const addRecoveryQuest = useCallback((task, options) => {
    const result = generateRecoveryQuest(recoveryStateRef.current, task, options);
    recoveryStateRef.current = result.state;
    setRecoveryState(result.state);
    return result;
  }, []);
  const completeQuest = useCallback((questId) => {
    const nextState = completeRecoveryQuest(recoveryStateRef.current, questId, getIstDateKey());
    recoveryStateRef.current = nextState;
    setRecoveryState(nextState);
  }, []);
  const expireQuest = useCallback((questId) => {
    const nextState = expireRecoveryQuest(recoveryStateRef.current, questId, getIstDateKey());
    recoveryStateRef.current = nextState;
    setRecoveryState(nextState);
  }, []);

  const value = useMemo(() => ({
    currentSchedule, setCurrentSchedule, weeklyAllowance, setWeeklyAllowance,
    recoveryState, addRecoveryQuest, completeQuest, expireQuest,
  }), [currentSchedule, weeklyAllowance, recoveryState, addRecoveryQuest, completeQuest, expireQuest]);

  return <TaskScheduleContext.Provider value={value}>{children}</TaskScheduleContext.Provider>;
}

export function useTaskSchedule() {
  const context = useContext(TaskScheduleContext);
  if (!context) throw new Error('useTaskSchedule must be used within TaskScheduleProvider.');
  return context;
}
