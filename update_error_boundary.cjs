const fs = require('fs');
let code = fs.readFileSync('src/components/ErrorBoundary.tsx', 'utf8');
code = code.replace('export class ErrorBoundary extends Component<Props, State> {', `export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.props = props;
  }`);
fs.writeFileSync('src/components/ErrorBoundary.tsx', code);
