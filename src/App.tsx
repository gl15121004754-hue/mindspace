import { Routes, Route } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useLocation } from 'react-router-dom'
import Layout from './components/Layout'
import ErrorBoundary from './components/ErrorBoundary'
import { ProtectedRoute } from './components/ProtectedRoute'

// Pages
import HomePage from './pages/HomePage'
import ChatPage from './pages/ChatPage'
import DailyRecordPage from './pages/DailyRecordPage'
import TimelinePage from './pages/TimelinePage'
import InsightPage from './pages/InsightPage'
import SOSEmotionPage from './pages/SOSEmotionPage'
import SOSAnalysisPage from './pages/SOSAnalysisPage'
import SOSCardPage from './pages/SOSCardPage'
import SOSCompletePage from './pages/SOSCompletePage'
import SOSFeedbackPage from './pages/SOSFeedbackPage'
import SOSCelebrationPage from './pages/SOSCelebrationPage'
import SettingsPage from './pages/SettingsPage'
import AccountPage from './pages/AccountPage'

function App() {
  const location = useLocation()

  return (
    <ErrorBoundary>
      <Layout>
        <AnimatePresence mode="wait">
          <Routes location={location} key={location.pathname}>
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  <HomePage />
                </motion.div>
              </ProtectedRoute>
            }
          />
          <Route
            path="/chat"
            element={
              <ProtectedRoute>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  <ChatPage />
                </motion.div>
              </ProtectedRoute>
            }
          />
          <Route
            path="/daily-record"
            element={
              <ProtectedRoute>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  <DailyRecordPage />
                </motion.div>
              </ProtectedRoute>
            }
          />
          <Route
            path="/timeline"
            element={
              <ProtectedRoute>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  <TimelinePage />
                </motion.div>
              </ProtectedRoute>
            }
          />
          <Route
            path="/insight"
            element={
              <ProtectedRoute>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  <InsightPage />
                </motion.div>
              </ProtectedRoute>
            }
          />
          {/* SOS急救流程路由 - 需要登录但不需要 API Key */}
          <Route
            path="/sos/emotion"
            element={
              <ProtectedRoute>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  <SOSEmotionPage />
                </motion.div>
              </ProtectedRoute>
            }
          />
          <Route
            path="/sos/analysis"
            element={
              <ProtectedRoute>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  <SOSAnalysisPage />
                </motion.div>
              </ProtectedRoute>
            }
          />
          <Route
            path="/sos/card/:emotionType"
            element={
              <ProtectedRoute>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  <SOSCardPage />
                </motion.div>
              </ProtectedRoute>
            }
          />
          {/* 合并后的完成页面（庆祝+反馈） */}
          <Route
            path="/sos/complete"
            element={
              <ProtectedRoute>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  <SOSCompletePage />
                </motion.div>
              </ProtectedRoute>
            }
          />
          <Route
            path="/sos/celebration"
            element={
              <ProtectedRoute>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  <SOSCelebrationPage />
                </motion.div>
              </ProtectedRoute>
            }
          />
          <Route
            path="/sos/feedback"
            element={
              <ProtectedRoute>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  <SOSFeedbackPage />
                </motion.div>
              </ProtectedRoute>
            }
          />
          <Route
            path="/account"
            element={
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                <AccountPage />
              </motion.div>
            }
          />
          {/* AI 设置页面 */}
          <Route
            path="/settings"
            element={
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                <SettingsPage />
              </motion.div>
            }
          />
          {/* 其他路由将逐步添加 */}
        </Routes>
        </AnimatePresence>
      </Layout>
    </ErrorBoundary>
  )
}

export default App
