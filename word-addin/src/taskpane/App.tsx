import React, { useState, useEffect, useCallback } from 'react';
import {
  FluentProvider,
  webDarkTheme,
  Button,
  Spinner,
  Badge,
  Tab,
  TabList,
  Card,
  CardHeader,
  Text,
  Textarea,
  Accordion,
  AccordionItem,
  AccordionHeader,
  AccordionPanel,
  tokens,
} from '@fluentui/react-components';
import {
  DocumentSearch24Regular,
  Shield24Regular,
  Library24Regular,
  Send24Regular,
  CheckmarkCircle24Filled,
  Warning24Filled,
  DismissCircle24Filled,
  ArrowSync24Regular,
  Person24Regular,
} from '@fluentui/react-icons';

// Types
interface RiskItem {
  id: string;
  type: string;
  severity: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  suggestion: string;
  location?: string;
}

interface ClauseSuggestion {
  id: string;
  name: string;
  category: string;
  risk_level: string;
  primary_text: string;
  fallback_text?: string;
}

interface AnalysisResult {
  overall_risk_score: number;
  risk_level: string;
  risks: RiskItem[];
  clause_suggestions: ClauseSuggestion[];
  summary: string;
}

interface User {
  email: string;
  name: string;
}

// Office.js initialization
declare const Office: typeof import('@microsoft/office-js').Office;

const API_BASE = process.env.NODE_ENV === 'production'
  ? 'https://mars-contracts.vercel.app'
  : 'http://localhost:3000';

export default function App() {
  const [isOfficeReady, setIsOfficeReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<string>('analyze');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [clauses, setClauses] = useState<ClauseSuggestion[]>([]);
  const [isLoadingClauses, setIsLoadingClauses] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize Office.js
  useEffect(() => {
    Office.onReady(() => {
      setIsOfficeReady(true);
      checkAuthStatus();
    });
  }, []);

  // Check authentication status
  const checkAuthStatus = async () => {
    try {
      const token = localStorage.getItem('mars_token');
      if (token) {
        const response = await fetch(`${API_BASE}/api/word-addin/auth/verify`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (response.ok) {
          const data = await response.json();
          setUser(data.user);
        } else {
          localStorage.removeItem('mars_token');
        }
      }
    } catch (err) {
      console.error('Auth check failed:', err);
    }
  };

  // Handle login
  const handleLogin = async () => {
    try {
      // Open dialog for OAuth flow
      const dialogUrl = `${API_BASE}/word-addin/auth.html`;
      Office.context.ui.displayDialogAsync(
        dialogUrl,
        { height: 60, width: 30 },
        (result) => {
          if (result.status === Office.AsyncResultStatus.Succeeded) {
            const dialog = result.value;
            dialog.addEventHandler(
              Office.EventType.DialogMessageReceived,
              (args: { message: string }) => {
                const message = JSON.parse(args.message);
                if (message.type === 'auth_success') {
                  localStorage.setItem('mars_token', message.token);
                  setUser(message.user);
                  dialog.close();
                } else if (message.type === 'auth_error') {
                  setError(message.error);
                  dialog.close();
                }
              }
            );
          }
        }
      );
    } catch (err) {
      setError('Failed to open login dialog');
    }
  };

  // Get document text from Word
  const getDocumentText = useCallback(async (): Promise<string> => {
    return new Promise((resolve, reject) => {
      Word.run(async (context) => {
        const body = context.document.body;
        body.load('text');
        await context.sync();
        resolve(body.text);
      }).catch(reject);
    });
  }, []);

  // Analyze document
  const analyzeDocument = async () => {
    if (!user) {
      setError('Please log in first');
      return;
    }

    setIsAnalyzing(true);
    setError(null);

    try {
      const documentText = await getDocumentText();

      if (!documentText || documentText.trim().length < 100) {
        setError('Document appears to be empty or too short to analyze');
        setIsAnalyzing(false);
        return;
      }

      const token = localStorage.getItem('mars_token');
      const response = await fetch(`${API_BASE}/api/word-addin/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ document_text: documentText }),
      });

      if (!response.ok) {
        throw new Error('Analysis failed');
      }

      const result = await response.json();
      setAnalysisResult(result);
    } catch (err) {
      setError('Failed to analyze document. Please try again.');
      console.error('Analysis error:', err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Load clause library
  const loadClauses = async () => {
    setIsLoadingClauses(true);
    try {
      const token = localStorage.getItem('mars_token');
      const response = await fetch(`${API_BASE}/api/word-addin/clauses`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setClauses(data.clauses || []);
      }
    } catch (err) {
      console.error('Failed to load clauses:', err);
    } finally {
      setIsLoadingClauses(false);
    }
  };

  // Insert clause at cursor
  const insertClause = async (text: string) => {
    try {
      await Word.run(async (context) => {
        const selection = context.document.getSelection();
        selection.insertText(text, Word.InsertLocation.replace);
        await context.sync();
      });
    } catch (err) {
      setError('Failed to insert clause');
      console.error('Insert error:', err);
    }
  };

  // Highlight text in document
  const highlightRisk = async (location: string) => {
    try {
      await Word.run(async (context) => {
        const searchResults = context.document.body.search(location, {
          matchCase: false,
          matchWholeWord: false,
        });
        searchResults.load('items');
        await context.sync();

        if (searchResults.items.length > 0) {
          const range = searchResults.items[0];
          range.font.highlightColor = '#FFE066';
          range.select();
          await context.sync();
        }
      });
    } catch (err) {
      console.error('Highlight error:', err);
    }
  };

  // Handle tab change
  const handleTabChange = (_: unknown, data: { value: string }) => {
    setActiveTab(data.value);
    if (data.value === 'clauses' && clauses.length === 0) {
      loadClauses();
    }
  };

  // Risk severity badge
  const getRiskBadge = (severity: string) => {
    const colors: Record<string, 'danger' | 'warning' | 'success'> = {
      high: 'danger',
      medium: 'warning',
      low: 'success',
    };
    return (
      <Badge appearance="filled" color={colors[severity] || 'informative'}>
        {severity.toUpperCase()}
      </Badge>
    );
  };

  // Loading state
  if (!isOfficeReady) {
    return (
      <FluentProvider theme={webDarkTheme}>
        <div style={styles.container}>
          <Spinner label="Loading MARS..." />
        </div>
      </FluentProvider>
    );
  }

  // Login required
  if (!user) {
    return (
      <FluentProvider theme={webDarkTheme}>
        <div style={styles.container}>
          <div style={styles.loginCard}>
            <Shield24Regular style={{ fontSize: 48, color: '#0078D4' }} />
            <Text size={500} weight="semibold">MARS Contract Review</Text>
            <Text size={300} style={{ color: '#A0A0A0', textAlign: 'center' }}>
              Sign in to analyze contracts and access the clause library
            </Text>
            <Button
              appearance="primary"
              icon={<Person24Regular />}
              onClick={handleLogin}
              style={{ marginTop: 16 }}
            >
              Sign in with Microsoft
            </Button>
          </div>
        </div>
      </FluentProvider>
    );
  }

  return (
    <FluentProvider theme={webDarkTheme}>
      <div style={styles.container}>
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.headerContent}>
            <Shield24Regular />
            <Text weight="semibold">MARS</Text>
          </div>
          <Text size={200} style={{ color: '#A0A0A0' }}>{user.email}</Text>
        </div>

        {/* Error Display */}
        {error && (
          <div style={styles.errorBanner}>
            <DismissCircle24Filled style={{ color: '#F87171' }} />
            <Text size={200}>{error}</Text>
            <Button
              appearance="subtle"
              size="small"
              onClick={() => setError(null)}
            >
              Dismiss
            </Button>
          </div>
        )}

        {/* Tabs */}
        <TabList
          selectedValue={activeTab}
          onTabSelect={handleTabChange}
          style={styles.tabs}
        >
          <Tab value="analyze" icon={<DocumentSearch24Regular />}>
            Analyze
          </Tab>
          <Tab value="clauses" icon={<Library24Regular />}>
            Clauses
          </Tab>
        </TabList>

        {/* Content */}
        <div style={styles.content}>
          {activeTab === 'analyze' && (
            <div style={styles.analyzeTab}>
              {/* Analyze Button */}
              <Button
                appearance="primary"
                icon={isAnalyzing ? <Spinner size="tiny" /> : <DocumentSearch24Regular />}
                onClick={analyzeDocument}
                disabled={isAnalyzing}
                style={{ width: '100%' }}
              >
                {isAnalyzing ? 'Analyzing...' : 'Analyze Document'}
              </Button>

              {/* Analysis Results */}
              {analysisResult && (
                <div style={styles.results}>
                  {/* Risk Score */}
                  <Card style={styles.scoreCard}>
                    <div style={styles.scoreContent}>
                      <div style={styles.scoreCircle(analysisResult.risk_level)}>
                        <Text size={700} weight="bold">
                          {Math.round(analysisResult.overall_risk_score)}
                        </Text>
                      </div>
                      <div>
                        <Text weight="semibold">Risk Score</Text>
                        <Text size={200} style={{ color: '#A0A0A0' }}>
                          {analysisResult.risk_level} risk
                        </Text>
                      </div>
                    </div>
                  </Card>

                  {/* Summary */}
                  <Card style={styles.summaryCard}>
                    <Text size={200} style={{ color: '#A0A0A0' }}>
                      {analysisResult.summary}
                    </Text>
                  </Card>

                  {/* Risks */}
                  {analysisResult.risks.length > 0 && (
                    <div>
                      <Text weight="semibold" style={{ marginBottom: 8, display: 'block' }}>
                        Issues Found ({analysisResult.risks.length})
                      </Text>
                      <Accordion collapsible>
                        {analysisResult.risks.map((risk) => (
                          <AccordionItem key={risk.id} value={risk.id}>
                            <AccordionHeader>
                              <div style={styles.riskHeader}>
                                {getRiskBadge(risk.severity)}
                                <Text size={200}>{risk.title}</Text>
                              </div>
                            </AccordionHeader>
                            <AccordionPanel>
                              <div style={styles.riskContent}>
                                <Text size={200}>{risk.description}</Text>
                                {risk.suggestion && (
                                  <div style={styles.suggestion}>
                                    <Text size={200} weight="semibold">Suggestion:</Text>
                                    <Text size={200}>{risk.suggestion}</Text>
                                    <Button
                                      size="small"
                                      appearance="subtle"
                                      onClick={() => insertClause(risk.suggestion)}
                                    >
                                      Insert
                                    </Button>
                                  </div>
                                )}
                                {risk.location && (
                                  <Button
                                    size="small"
                                    appearance="outline"
                                    onClick={() => highlightRisk(risk.location!)}
                                  >
                                    Highlight in Document
                                  </Button>
                                )}
                              </div>
                            </AccordionPanel>
                          </AccordionItem>
                        ))}
                      </Accordion>
                    </div>
                  )}

                  {/* Clause Suggestions */}
                  {analysisResult.clause_suggestions.length > 0 && (
                    <div>
                      <Text weight="semibold" style={{ marginBottom: 8, display: 'block' }}>
                        Recommended Clauses
                      </Text>
                      {analysisResult.clause_suggestions.map((clause) => (
                        <Card key={clause.id} style={styles.clauseCard}>
                          <CardHeader
                            header={<Text weight="semibold">{clause.name}</Text>}
                            description={<Text size={200}>{clause.category}</Text>}
                            action={
                              <Button
                                size="small"
                                onClick={() => insertClause(clause.primary_text)}
                              >
                                Insert
                              </Button>
                            }
                          />
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'clauses' && (
            <div style={styles.clausesTab}>
              <Button
                appearance="subtle"
                icon={<ArrowSync24Regular />}
                onClick={loadClauses}
                disabled={isLoadingClauses}
              >
                Refresh
              </Button>

              {isLoadingClauses ? (
                <Spinner label="Loading clauses..." />
              ) : clauses.length === 0 ? (
                <Text style={{ color: '#A0A0A0', textAlign: 'center' }}>
                  No clauses available. Add clauses in the MARS web app.
                </Text>
              ) : (
                <div style={styles.clauseList}>
                  {clauses.map((clause) => (
                    <Card key={clause.id} style={styles.clauseCard}>
                      <CardHeader
                        header={<Text weight="semibold">{clause.name}</Text>}
                        description={
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <Text size={200}>{clause.category}</Text>
                            {getRiskBadge(clause.risk_level)}
                          </div>
                        }
                      />
                      <div style={styles.clauseText}>
                        <Text size={200}>
                          {clause.primary_text.substring(0, 150)}
                          {clause.primary_text.length > 150 ? '...' : ''}
                        </Text>
                      </div>
                      <div style={styles.clauseActions}>
                        <Button
                          size="small"
                          appearance="primary"
                          onClick={() => insertClause(clause.primary_text)}
                        >
                          Insert Primary
                        </Button>
                        {clause.fallback_text && (
                          <Button
                            size="small"
                            appearance="outline"
                            onClick={() => insertClause(clause.fallback_text!)}
                          >
                            Insert Fallback
                          </Button>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </FluentProvider>
  );
}

// Styles
const styles: Record<string, React.CSSProperties | ((param: string) => React.CSSProperties)> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    backgroundColor: '#1F1F1F',
    color: '#FFFFFF',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 16px',
    borderBottom: '1px solid #333',
  },
  headerContent: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  errorBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 16px',
    backgroundColor: '#7F1D1D',
    color: '#FCA5A5',
  },
  tabs: {
    borderBottom: '1px solid #333',
  },
  content: {
    flex: 1,
    overflow: 'auto',
    padding: 16,
  },
  loginCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 16,
    padding: 32,
    margin: 'auto',
  },
  analyzeTab: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  results: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  scoreCard: {
    padding: 16,
    backgroundColor: '#2D2D2D',
  },
  scoreContent: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
  },
  scoreCircle: (riskLevel: string) => ({
    width: 64,
    height: 64,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: riskLevel === 'high' ? '#7F1D1D' : riskLevel === 'medium' ? '#78350F' : '#14532D',
  }),
  summaryCard: {
    padding: 12,
    backgroundColor: '#2D2D2D',
  },
  riskHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  riskContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    paddingTop: 8,
  },
  suggestion: {
    padding: 8,
    backgroundColor: '#1F2937',
    borderRadius: 4,
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  clausesTab: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  clauseList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  clauseCard: {
    backgroundColor: '#2D2D2D',
    padding: 12,
  },
  clauseText: {
    padding: '8px 0',
  },
  clauseActions: {
    display: 'flex',
    gap: 8,
    paddingTop: 8,
  },
};
