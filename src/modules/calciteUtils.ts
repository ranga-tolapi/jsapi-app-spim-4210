export const calciteAlert = (title: string, message: string, color = 'blue', icon = true || 'lightbulb') => {
  const alert = document.createElement('calcite-alert');
  alert.color = color;
  alert.icon = icon;

  const titleDiv = document.createElement('div');
  titleDiv.slot = 'title';
  titleDiv.textContent = title;
  alert.appendChild(titleDiv);

  const messageDiv = document.createElement('div');
  messageDiv.slot = 'message';
  messageDiv.textContent = message;
  alert.appendChild(messageDiv);

  alert.addEventListener('calciteAlertClose', (e) => {
    document.body.removeChild(e.target);
  });

  alert.active = true;

  document.body.appendChild(alert);
};
