import { useReducer } from 'react';

const initialState = {
  selectedRequestIds: [],
  selectedApprovalIds: [],
  selectedUserTokens: [],
};

const toggleValue = (list, value) => (
  list.includes(value) ? list.filter((item) => item !== value) : [...list, value]
);

const reducer = (state, action) => {
  switch (action.type) {
    case 'toggle_request':
      return { ...state, selectedRequestIds: toggleValue(state.selectedRequestIds, action.payload) };
    case 'toggle_approval':
      return { ...state, selectedApprovalIds: toggleValue(state.selectedApprovalIds, action.payload) };
    case 'toggle_user':
      return { ...state, selectedUserTokens: toggleValue(state.selectedUserTokens, action.payload) };
    case 'set_request':
      return { ...state, selectedRequestIds: action.payload };
    case 'set_approval':
      return { ...state, selectedApprovalIds: action.payload };
    case 'set_user':
      return { ...state, selectedUserTokens: action.payload };
    case 'clear_request':
      return { ...state, selectedRequestIds: [] };
    case 'clear_approval':
      return { ...state, selectedApprovalIds: [] };
    case 'clear_user':
      return { ...state, selectedUserTokens: [] };
    case 'clear_all':
      return initialState;
    default:
      return state;
  }
};

export const useApprovalQueue = () => {
  const [state, dispatch] = useReducer(reducer, initialState);

  return {
    selectedRequestIds: state.selectedRequestIds,
    selectedApprovalIds: state.selectedApprovalIds,
    selectedUserTokens: state.selectedUserTokens,
    toggleRequestSelection: (id) => dispatch({ type: 'toggle_request', payload: id }),
    toggleApprovalSelection: (id) => dispatch({ type: 'toggle_approval', payload: id }),
    toggleUserSelection: (token) => dispatch({ type: 'toggle_user', payload: token }),
    setSelectedRequestIds: (ids) => dispatch({ type: 'set_request', payload: ids }),
    setSelectedApprovalIds: (ids) => dispatch({ type: 'set_approval', payload: ids }),
    setSelectedUserTokens: (tokens) => dispatch({ type: 'set_user', payload: tokens }),
    clearSelectedRequestIds: () => dispatch({ type: 'clear_request' }),
    clearSelectedApprovalIds: () => dispatch({ type: 'clear_approval' }),
    clearSelectedUserTokens: () => dispatch({ type: 'clear_user' }),
    clearAllSelections: () => dispatch({ type: 'clear_all' }),
  };
};
