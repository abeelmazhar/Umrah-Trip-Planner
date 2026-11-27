import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAssistantDrawer } from '../context/AssistantDrawerContext';

/** Older links to /assistant open the side panel and return to the previous page. */
export default function Assistant() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { openDrawer } = useAssistantDrawer();
  const trip = params.get('trip') || '';

  useEffect(() => {
    openDrawer(trip || undefined);
    navigate('/', { replace: true });
  }, [openDrawer, navigate, trip]);

  return null;
}
