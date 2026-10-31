import { useParams } from 'react-router-dom';
import { LadderSession } from '../components/LadderSession.jsx';

export function PracticePage() {
  const { attemptId } = useParams();
  return <LadderSession key={attemptId} attemptId={attemptId} />;
}
