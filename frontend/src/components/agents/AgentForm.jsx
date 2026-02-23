import React, { useState, useEffect } from 'react';
import { useAgentManagement } from '../../context/AgentManagementContext';

const AgentForm = ({ agent, onClose, onSave }) => {
  const { addAgent, updateAgent, testConnection } = useAgentManagement();

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: 'demo',
    apiEndpoint: '',
    webhookUrl: '',
    apiKey: '',
    enabled: false,
  });

  const [errors, setErrors] = useState({});
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  // Populate form if editing existing agent
  useEffect(() => {
    if (agent) {
      setFormData({
        name: agent.name || '',
        description: agent.description || '',
        type: agent.type || 'demo',
        apiEndpoint: agent.apiEndpoint || '',
        webhookUrl: agent.webhookUrl || '',
        apiKey: agent.apiKey || '',
        enabled: agent.enabled || false,
      });
    }
  }, [agent]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));

    // Clear error for this field
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }

    if (formData.type === 'live' || formData.type === 'api') {
      if (!formData.apiEndpoint.trim()) {
        newErrors.apiEndpoint = 'API endpoint is required for this type';
      } else {
        // Validate URL format
        try {
          new URL(formData.apiEndpoint);
        } catch {
          newErrors.apiEndpoint = 'Invalid URL format';
        }
      }
    }

    if (formData.type === 'webhook') {
      if (!formData.webhookUrl.trim()) {
        newErrors.webhookUrl = 'Webhook URL is required';
      } else {
        // Validate URL format
        try {
          new URL(formData.webhookUrl);
        } catch {
          newErrors.webhookUrl = 'Invalid URL format';
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);

    // Create temporary agent for testing
    const tempAgent = {
      id: agent?.id || 'temp_test',
      ...formData,
    };

    try {
      // For new agents, we need to mock a test since they don't exist yet
      if (!agent) {
        if (formData.type === 'demo') {
          setTestResult({ success: true, message: 'Simulation agent is ready to use' });
        } else if (formData.type === 'live' || formData.type === 'api') {
          // Try to fetch the health endpoint
          const response = await fetch(`${formData.apiEndpoint.replace('/api/v1', '')}/health`);
          if (response.ok) {
            setTestResult({ success: true, message: 'Connection successful' });
          } else {
            setTestResult({ success: false, message: 'Connection failed - agent not reachable' });
          }
        } else {
          setTestResult({ success: true, message: 'Configuration looks valid' });
        }
      } else {
        // Test existing agent
        const result = await testConnection(agent.id);
        setTestResult(result);
      }

      setTimeout(() => setTestResult(null), 5000);
    } catch (error) {
      setTestResult({ success: false, message: error.message });
      setTimeout(() => setTestResult(null), 5000);
    } finally {
      setIsTesting(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSaving(true);

    try {
      if (agent) {
        // Update existing agent
        updateAgent(agent.id, formData);
      } else {
        // Add new agent
        addAgent(formData);
      }

      onSave && onSave();
      onClose();
    } catch (error) {
      console.error('Error saving agent:', error);
      setErrors({ submit: error.message });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-xl border border-gray-700 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <h2 className="text-xl font-semibold text-white">
            {agent ? 'Edit Agent' : 'Add New Agent'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Agent Name *
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500 transition-colors"
              placeholder="My Trading Agent"
            />
            {errors.name && (
              <p className="mt-1 text-sm text-red-400">{errors.name}</p>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Description
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={3}
              className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500 transition-colors resize-none"
              placeholder="Describe this agent's purpose..."
            />
          </div>

          {/* Type */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Agent Type *
            </label>
            <select
              name="type"
              value={formData.type}
              onChange={handleChange}
              className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500 transition-colors"
            >
              <option value="demo">Simulation</option>
              <option value="live">Live Trading</option>
              <option value="api">API Integration</option>
              <option value="webhook">Webhook</option>
            </select>
            <p className="mt-1 text-xs text-gray-500">
              {formData.type === 'demo' && 'Generates simulated trades for testing'}
              {formData.type === 'live' && 'Connects to a live trading agent via API'}
              {formData.type === 'api' && 'Connects to external API for trade data'}
              {formData.type === 'webhook' && 'Receives trade signals via webhooks'}
            </p>
          </div>

          {/* API Endpoint (for live/api types) */}
          {(formData.type === 'live' || formData.type === 'api') && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                API Endpoint *
              </label>
              <input
                type="text"
                name="apiEndpoint"
                value={formData.apiEndpoint}
                onChange={handleChange}
                className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500 transition-colors"
                placeholder="https://your-agent.example.com/api/v1"
              />
              {errors.apiEndpoint && (
                <p className="mt-1 text-sm text-red-400">{errors.apiEndpoint}</p>
              )}
            </div>
          )}

          {/* Webhook URL (for webhook type) */}
          {formData.type === 'webhook' && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Webhook URL *
              </label>
              <input
                type="text"
                name="webhookUrl"
                value={formData.webhookUrl}
                onChange={handleChange}
                className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500 transition-colors"
                placeholder="https://your-dashboard.com/webhook/signals"
              />
              {errors.webhookUrl && (
                <p className="mt-1 text-sm text-red-400">{errors.webhookUrl}</p>
              )}
            </div>
          )}

          {/* API Key (for live/api types) */}
          {(formData.type === 'live' || formData.type === 'api') && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                API Key (Optional)
              </label>
              <input
                type="password"
                name="apiKey"
                value={formData.apiKey}
                onChange={handleChange}
                className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500 transition-colors"
                placeholder="Enter API key if required"
              />
            </div>
          )}

          {/* Enable Immediately */}
          <div className="flex items-center">
            <input
              type="checkbox"
              name="enabled"
              checked={formData.enabled}
              onChange={handleChange}
              className="w-4 h-4 text-blue-500 bg-gray-900 border-gray-700 rounded focus:ring-blue-500"
            />
            <label className="ml-2 text-sm text-gray-300">
              Enable agent immediately after saving
            </label>
          </div>

          {/* Test Result */}
          {testResult && (
            <div className={`p-4 rounded-lg text-sm ${
              testResult.success
                ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                : 'bg-red-500/20 text-red-400 border border-red-500/30'
            }`}>
              {testResult.message}
            </div>
          )}

          {/* Submit Error */}
          {errors.submit && (
            <div className="p-4 bg-red-500/20 text-red-400 rounded-lg text-sm border border-red-500/30">
              {errors.submit}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3 pt-4">
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={isTesting}
              className="px-6 py-2 bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30 transition-all border border-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {isTesting ? 'Testing...' : 'Test Connection'}
            </button>

            <div className="flex-1" />

            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-all font-medium"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSaving}
              className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {isSaving ? 'Saving...' : agent ? 'Update Agent' : 'Add Agent'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AgentForm;
