/** Specific static files precede the dynamic English API namespace. */
export function englishDeploymentRoutes(){
  return [
    {src:'/en(?:/(.*))?',dest:'/api/index.js?__route=english&path=/en/$1'},
    {src:'/_english/marketplace/assets/([A-Za-z0-9_.-]+)',dest:'/_english/marketplace/assets/$1'},
    {src:'/_english/(.*)',dest:'/api/index.js?__route=english&path=/_english/$1'},
    {src:'/',dest:'/api/index.js?__route=english-home'},
  ];
}
