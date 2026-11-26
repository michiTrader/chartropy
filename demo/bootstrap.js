if (window.location.protocol !== 'file:') {
  const module = document.createElement('script');
  module.type = 'module';
  module.src = './lab.mjs';
  document.head.append(module);
}
