import { usePermTime } from '../../hooks/usePermTime';
import './PermDateTime.css';

export default function PermDateTime() {
  const { time, seconds, date, weekday } = usePermTime();

  return (
    <div className="perm-datetime">
      <div className="perm-datetime__header">
        <span className="perm-datetime__location">📍 Пермь</span>
        <span className="perm-datetime__timezone">МСК+2</span>
      </div>
      
      <div className="perm-datetime__time">
        <span className="perm-datetime__hours">{time}</span>
        <span className="perm-datetime__seconds">{seconds}</span>
      </div>
      
      <div className="perm-datetime__date">
        <span className="perm-datetime__weekday">{weekday}</span>
        <span className="perm-datetime__fulldate">{date}</span>
      </div>
    </div>
  );
}