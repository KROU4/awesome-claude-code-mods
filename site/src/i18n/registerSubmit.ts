// Side-effect module: puts the Submit section's strings into the dictionary. Imported first by
// sections/Submit.tsx, so it runs before any submit component reads a 'submit.*' key.
import { registerDict } from './index'
import submit from './submit'

registerDict('submit', submit)
