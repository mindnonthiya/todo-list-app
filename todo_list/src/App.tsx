import TodoList from "./components/TodoList";
import { LanguageProvider } from "./contexts/LanguageContext";
import { ThemeProvider } from "./contexts/ThemeContext";

function App() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <TodoList />
      </LanguageProvider>
    </ThemeProvider>
  );
}

export default App;
