import { useState, useEffect, useRef } from 'react';
import { useAgentManagement } from '../context/AgentManagementContext';
import { useBotStatus } from '../context/BotStatusContext';

const DEXSCREENER_API = 'https://api.dexscreener.com/latest/dex';

/**
 * Hook to get live prices for open positions
 * Supports:
 * - Demo agents (simulator)
 * - Live agents (Railway API)
 * - Webhook trades (DexScreener direct)
 */
export const useLivePrices = (openTrades) => {
  const { selectedAgent, demoAgents } = useAgentManagement();
  const { botEnabled } = useBotStatus();
  const [livePrices, setLivePrices] = useState({});
  const abortControllerRef = useRef(null);

  // DEMO AGENTS: Get prices from simulator
  useEffect(() => {
    if (!selectedAgent || selectedAgent.type !== 'demo' || !demoAgents) return;
    if (!openTrades || openTrades.length === 0) return;

    const simulator = demoAgents.get(selectedAgent.id);
    if (!simulator) return;

    // Get current prices from simulator
    const updatePrices = () => {
      const prices = {};
      openTrades.forEach(trade => {
        if (trade.token && simulator.tokenMarketData && simulator.tokenMarketData[trade.token]) {
          prices[trade.id] = simulator.tokenMarketData[trade.token].currentPrice;
        }
      });
      setLivePrices(prices);
    };

    // Initial price update
    updatePrices();

    // Subscribe to scan events to update prices
    const unsubscribe = simulator.on('scan', () => {
      updatePrices();
    });

    // Update prices every 2 seconds
    const interval = setInterval(updatePrices, 2000);

    return () => {
      if (unsubscribe && typeof unsubscribe === 'function') {
        unsubscribe();
      }
      clearInterval(interval);
    };
  }, [selectedAgent, demoAgents, openTrades]);

  // LIVE AGENTS: Fetch prices from Railway API positions endpoint
  useEffect(() => {
    if (!selectedAgent || (selectedAgent.type !== 'live' && selectedAgent.type !== 'api')) return;
    if (!openTrades || openTrades.length === 0) return;

    // Get base URL from agent endpoint
    let baseUrl = selectedAgent.apiEndpoint || '';
    if (!baseUrl) return;
    baseUrl = baseUrl.replace(/\/api\/v1\/?$/, '');

    const fetchLivePrices = async () => {
      try {
        // Cancel previous request
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }
        abortControllerRef.current = new AbortController();

        const response = await fetch(`${baseUrl}/api/v1/positions`, {
          signal: abortControllerRef.current.signal
        });

        if (response.ok) {
          const data = await response.json();
          const positions = data.data?.positions || data.positions || [];

          // Map positions by token address to get current prices
          const prices = {};
          openTrades.forEach(trade => {
            const tokenAddr = trade.tokenAddress || trade.token_address;
            const position = positions.find(p =>
              p.tokenAddress === tokenAddr ||
              p.token_address === tokenAddr ||
              p.id === trade.id
            );
            if (position && position.currentPrice) {
              prices[trade.id] = position.currentPrice;
            }
          });
          setLivePrices(prices);
        }
      } catch (error) {
        if (error.name !== 'AbortError') {
          console.log('Live prices fetch failed:', error.message);
        }
      }
    };

    // Initial fetch
    fetchLivePrices();

    // Update every 3 seconds for live agents
    const interval = setInterval(fetchLivePrices, 3000);

    return () => {
      clearInterval(interval);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [selectedAgent, openTrades]);

  // FALLBACK: Fetch directly from DexScreener for trades without live prices
  // Only when bot is enabled - saves API calls when bot is off
  useEffect(() => {
    if (!botEnabled) return; // Don't fetch live prices when bot is disabled
    if (!openTrades || openTrades.length === 0) return;

    // Get trades that need price updates (no live price yet)
    const tradesNeedingPrices = openTrades.filter(trade => {
      const hasLivePrice = livePrices[trade.id] || trade.livePrice || trade.currentPrice;
      return !hasLivePrice && trade.tokenAddress;
    });

    if (tradesNeedingPrices.length === 0) return;

    const fetchFromDexScreener = async () => {
      const uniqueAddresses = [...new Set(tradesNeedingPrices.map(t => t.tokenAddress).filter(Boolean))];
      const newPrices = { ...livePrices };

      for (const address of uniqueAddresses.slice(0, 5)) {
        try {
          const response = await fetch(`${DEXSCREENER_API}/tokens/${address}`);
          if (response.ok) {
            const data = await response.json();
            if (data.pairs && data.pairs.length > 0) {
              const bestPair = data.pairs.sort((a, b) =>
                (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0)
              )[0];
              const priceUsd = parseFloat(bestPair.priceUsd);

              // Apply to all trades with this token
              tradesNeedingPrices.forEach(trade => {
                if (trade.tokenAddress === address) {
                  newPrices[trade.id] = priceUsd;
                }
              });
            }
          }
        } catch (e) {
          // Skip failed fetches
        }
      }

      setLivePrices(newPrices);
    };

    fetchFromDexScreener();

    // Update every 5 seconds
    const interval = setInterval(fetchFromDexScreener, 5000);
    return () => clearInterval(interval);
  }, [openTrades, livePrices, botEnabled]);

  return livePrices;
};
