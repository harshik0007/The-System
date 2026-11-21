export function loadCoreTaskRequests(taskApi, signal) {
  return Promise.allSettled([
    taskApi.currentSchedule({ signal }),
    taskApi.tasks({ signal }),
    taskApi.allowance({ signal }),
  ]);
}
