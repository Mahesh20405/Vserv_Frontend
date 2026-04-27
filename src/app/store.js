import { configureStore } from '@reduxjs/toolkit'
import rootReducer from './rootReducer'

const loggerMiddleware = () => (next) => (action) => {
  if (import.meta.env.DEV) {
    console.debug('[store]', action.type)
  }
  return next(action)
}

const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(loggerMiddleware),
})

export default store
export const { dispatch, getState } = store
