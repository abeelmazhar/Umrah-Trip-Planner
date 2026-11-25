import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import useFetch from '../hooks/useFetch';
import { Loading } from '../components/ui';
import LostCardView from '../components/group/LostCardView';

/** Public page behind the QR code on a lost card. No login needed. */
export default function LostCard() {
  const { token } = useParams();
  const { t } = useTranslation();
  const { data: card, loading } = useFetch(`/lost/${token}`);
  if (loading) return <Loading />;
  if (!card) return <div className="card text-center">{t('lost.notFound')}</div>;
  return <LostCardView card={card} />;
}
